import os
import redis
import json
import time
import logging
from kubernetes import client, config
from kubernetes.client.rest import ApiException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Redis setup
redis_host = os.getenv("REDIS_HOST", "redis-service")
redis_password = os.getenv("REDIS_PASSWORD")

try:
    r = redis.Redis(
        host=redis_host, 
        port=6379, 
        db=0, 
        password=redis_password,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True
    )
    # Test connection
    r.ping()
    logger.info(f"Successfully connected to Redis at {redis_host}")
except redis.ConnectionError as e:
    logger.error(f"Failed to connect to Redis at {redis_host}: {e}")
    exit(1)

def setup_kubernetes():
    """Setup Kubernetes client with fallback options"""
    try:
        # Try in-cluster configuration first
        config.load_incluster_config()
        logger.info("Using in-cluster Kubernetes configuration")
        return True
    except Exception as e:
        logger.warning(f"In-cluster config failed: {e}")
        try:
            # Fall back to local kubeconfig
            config.load_kube_config()
            logger.info("Using local Kubernetes configuration")
            return True
        except Exception as e:
            logger.error(f"Failed to load Kubernetes config: {e}")
            return False

def create_k8s_container(container_data):
    """Create actual container/pod in Kubernetes"""
    container_id = container_data["container_id"]
    container_name = container_data.get("name", f"container-{container_id[:8]}")
    image = container_data.get("image", "nginx:latest")
    logger.info(f"Creating container {container_id} with image {image}")
    try:
        v1 = client.CoreV1Api()
        # Define the pod spec with better resource management
        pod_spec = client.V1Pod(
            api_version="v1",
            kind="Pod",
            metadata=client.V1ObjectMeta(
                name=f"pod-{container_id[:8]}",
                labels={
                    "app": "container-manager",
                    "container-id": container_id,
                    "created-by": "k3-manager"
                },
                annotations={
                    "created-at": container_data.get("created_at", ""),
                    "original-name": container_name
                }
            ),
            spec=client.V1PodSpec(
                containers=[
                    client.V1Container(
                        name=container_name.replace("_", "-").lower(),  # K8s name requirements
                        image=image,
                        image_pull_policy="IfNotPresent",  # Use local images if available
                        ports=[client.V1ContainerPort(container_port=80)],
                        resources=client.V1ResourceRequirements(
                            requests={"memory": "64Mi", "cpu": "100m"},
                            limits={"memory": "128Mi", "cpu": "200m"}
                        ),
                        # Add health checks
                        readiness_probe=client.V1Probe(
                            http_get=client.V1HTTPGetAction(
                                path="/",
                                port=80
                            ),
                            initial_delay_seconds=1,
                            period_seconds=2,
                            failure_threshold=2
                        ),
                        # Environment variables
                        env=[
                            client.V1EnvVar(name="CONTAINER_ID", value=container_id),
                            client.V1EnvVar(name="CREATED_BY", value="k3-manager")
                        ]
                    )
                ],
                restart_policy="Always",
                # Add node selector for better placement (optional)
                # node_selector={"kubernetes.io/arch": "amd64"}
            )
        )
        # Create the pod
        namespace = os.getenv("NAMESPACE", "sprout")
        logger.info(f"Creating pod in namespace: {namespace}")
        response = v1.create_namespaced_pod(namespace=namespace, body=pod_spec)
        logger.info(f"Successfully created pod: {response.metadata.name} for container: {container_id}")
        # Update container status in Redis
        container_info = {
            "id": container_id,
            "status": "running",
            "pod_name": response.metadata.name,
            "namespace": namespace,
            "created_at": container_data.get("created_at", ""),
            "name": container_name,
            "image": image,
            "uid": str(response.metadata.uid)
        }
        r.hset(f"container:{container_id}", mapping=container_info)
        # Also publish success event
        r.xadd("container_events", {
            "event_type": "container_status_update",
            "container_id": container_id,
            "status": "running",
            "pod_name": response.metadata.name,
            "timestamp": time.time()
        })
        return True
    except ApiException as e:
        error_details = {
            "status": e.status,
            "reason": e.reason,
            "body": e.body if e.body else "No additional details"
        }
        logger.error(f"Kubernetes API error for container {container_id}: {error_details}")
        # Update status to failed with detailed error
        r.hset(f"container:{container_id}", mapping={
            "id": container_id,
            "status": "failed",
            "error": f"K8s API Error: {e.status} - {e.reason}",
            "error_details": str(error_details),
            "failed_at": time.time()
        })
        # Publish failure event
        r.xadd("container_events", {
            "event_type": "container_status_update",
            "container_id": container_id,
            "status": "failed",
            "error": str(e),
            "timestamp": time.time()
        })
        return False
    except Exception as e:
        logger.error(f"Unexpected error creating container {container_id}: {str(e)}")
        # Update status to failed
        r.hset(f"container:{container_id}", mapping={
            "id": container_id,
            "status": "failed",
            "error": f"Unexpected error: {str(e)}",
            "failed_at": time.time()
        })
        # Publish failure event
        r.xadd("container_events", {
            "event_type": "container_status_update",
            "container_id": container_id,
            "status": "failed",
            "error": str(e),
            "timestamp": time.time()
        })
        return False

def delete_k8s_container(container_id):
    """Delete container/pod in Kubernetes with improved error handling"""
    logger.info(f"Starting deletion process for container {container_id}")
    try:
        v1 = client.CoreV1Api()
        namespace = os.getenv("NAMESPACE", "sprout")
        # First, try to find the pod by looking for pods with the container-id label
        label_selector = f"container-id={container_id}"
        try:
            pods = v1.list_namespaced_pod(
                namespace=namespace,
                label_selector=label_selector
            )
            if not pods.items:
                # Fallback to the naming convention
                pod_name = f"pod-{container_id[:8]}"
                logger.info(f"No pods found with label, trying pod name: {pod_name}")
                # Check if pod exists before attempting deletion
                try:
                    pod = v1.read_namespaced_pod(name=pod_name, namespace=namespace)
                    pods_to_delete = [pod]
                except ApiException as e:
                    if e.status == 404:
                        logger.warning(f"Pod {pod_name} not found, may have been already deleted")
                        # Clean up Redis entry anyway
                        r.delete(f"container:{container_id}")
                        # Publish deletion event
                        r.xadd("container_events", {
                            "event_type": "container_status_update",
                            "container_id": container_id,
                            "status": "deleted",
                            "timestamp": time.time()
                        })
                        return True
                    else:
                        raise e
            else:
                pods_to_delete = pods.items
                logger.info(f"Found {len(pods_to_delete)} pods to delete for container {container_id}")
        except Exception as e:
            logger.error(f"Error finding pods for container {container_id}: {e}")
            return False
        # Delete all found pods
        deletion_successful = True
        for pod in pods_to_delete:
            try:
                # Delete with proper cleanup options
                delete_options = client.V1DeleteOptions(
                    propagation_policy="Background",
                    grace_period_seconds=30
                )
                response = v1.delete_namespaced_pod(
                    name=pod.metadata.name,
                    namespace=namespace,
                    body=delete_options
                )
                logger.info(f"Successfully initiated deletion of pod: {pod.metadata.name}")
                # Wait a moment for the deletion to be processed
                time.sleep(1)
                # Verify deletion started
                try:
                    check_pod = v1.read_namespaced_pod(
                        name=pod.metadata.name, 
                        namespace=namespace
                    )
                    if check_pod.metadata.deletion_timestamp:
                        logger.info(f"Pod {pod.metadata.name} is being terminated")
                    else:
                        logger.warning(f"Pod {pod.metadata.name} deletion may not have started")
                except ApiException as e:
                    if e.status == 404:
                        logger.info(f"Pod {pod.metadata.name} successfully deleted")
                    else:
                        logger.error(f"Error checking pod deletion status: {e}")
            except ApiException as e:
                if e.status == 404:
                    logger.info(f"Pod {pod.metadata.name} already deleted")
                else:
                    logger.error(f"Failed to delete pod {pod.metadata.name}: {e}")
                    deletion_successful = False
            except Exception as e:
                logger.error(f"Unexpected error deleting pod {pod.metadata.name}: {e}")
                deletion_successful = False
        if deletion_successful:
            # Clean up Redis state
            r.delete(f"container:{container_id}")
            # Publish deletion event
            r.xadd("container_events", {
                "event_type": "container_status_update",
                "container_id": container_id,
                "status": "deleted",
                "timestamp": time.time()
            })
            logger.info(f"Successfully processed deletion for container {container_id}")
            return True
        else:
            logger.error(f"Some pods failed to delete for container {container_id}")
            return False
    except Exception as e:
        logger.error(f"Unexpected error during deletion of container {container_id}: {e}")
        # Update Redis with error status
        try:
            r.hset(f"container:{container_id}", mapping={
                "status": "deletion_failed",
                "error": f"Deletion error: {str(e)}",
                "failed_at": time.time()
            })
        except Exception as redis_error:
            logger.error(f"Failed to update Redis with deletion error: {redis_error}")
        return False

def process_stream():
    """Process container events from Redis stream with enhanced debugging"""
    consumer_name = f"consumer-{os.getpid()}"
    # Create consumer group if not exists
    try:
        r.xgroup_create("container_events", "keda-consumer", id="0", mkstream=True)
        logger.info("Created consumer group 'keda-consumer'")
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            logger.info("Consumer group 'keda-consumer' already exists")
        else:
            logger.error(f"Failed to create consumer group: {e}")
            return
    logger.info(f"Starting container event processor with consumer: {consumer_name}")
    # Setup Kubernetes connection
    if not setup_kubernetes():
        logger.error("Failed to setup Kubernetes connection, exiting")
        return
    consecutive_errors = 0
    max_consecutive_errors = 5
    while True:
        try:
            # Read from stream with timeout
            results = r.xreadgroup(
                groupname="keda-consumer",
                consumername=consumer_name,
                streams={"container_events": ">"},
                count=1,
                block=1000  
            )
            if not results:
                # No new messages, reset error counter
                consecutive_errors = 0
                continue
            for stream, messages in results:
                for message_id, message in messages:
                    try:
                        # Decode message
                        event = {k.decode(): v.decode() for k, v in message.items()}
                        event_type = event.get("event_type")
                        container_id = event.get("container_id")
                        logger.info(f"Processing event: {event_type} for container: {container_id}")
                        logger.debug(f"Full event data: {event}")
                        success = False
                        if event_type == "container_created":
                            success = create_k8s_container(event)
                        elif event_type == "container_deleted":
                            logger.info(f"Starting deletion process for container: {container_id}")
                            success = delete_k8s_container(container_id)
                            logger.info(f"Deletion result for {container_id}: {success}")
                        else:
                            logger.warning(f"Unknown event type: {event_type}")
                            success = True  # Don't retry unknown events
                        if success:
                            # Acknowledge successful processing
                            r.xack("container_events", "keda-consumer", message_id)
                            logger.info(f"Successfully processed and acknowledged event {message_id}")
                            consecutive_errors = 0
                        else:
                            logger.error(f"Failed to process event {message_id}, will retry later")
                            # Don't acknowledge failed messages so they can be retried
                    except Exception as e:
                        logger.error(f"Error processing message {message_id}: {e}")
                        logger.error(f"Message content: {message}")
                        # Don't acknowledge failed messages so they can be retried
        except redis.ConnectionError as e:
            consecutive_errors += 1
            logger.error(f"Redis connection error ({consecutive_errors}/{max_consecutive_errors}): {e}")
            if consecutive_errors >= max_consecutive_errors:
                logger.critical("Too many consecutive Redis errors, exiting")
                break
            time.sleep(min(consecutive_errors * 2, 30))  # Exponential backoff, max 30s
        except Exception as e:
            consecutive_errors += 1
            logger.error(f"Unexpected error in stream processing ({consecutive_errors}/{max_consecutive_errors}): {e}")
            if consecutive_errors >= max_consecutive_errors:
                logger.critical("Too many consecutive errors, exiting")
                break
            time.sleep(5)

def health_check():
    """Perform health checks on startup"""
    logger.info("Performing health checks...")
    # Check Redis
    try:
        r.ping()
        logger.info("â    Redis connection: OK")
    except Exception as e:
        logger.error(f"â    Redis connection: FAILED - {e}")
        return False
    # Check Kubernetes
    try:
        if setup_kubernetes():
            v1 = client.CoreV1Api()
            namespaces = v1.list_namespace(limit=1)
            logger.info("â    Kubernetes connection: OK")
        else:
            logger.error("â    Kubernetes connection: FAILED")
            return False
    except Exception as e:
        logger.error(f"â    Kubernetes connection: FAILED - {e}")
        return False
    # Check stream exists
    try:
        stream_info = r.xinfo_stream("container_events")
        logger.info(f"â    Container events stream: OK (length: {stream_info['length']})")
    except Exception as e:
        logger.warning(f"Container events stream not found, will be created: {e}")
    logger.info("Health checks completed")
    return True

if __name__ == "__main__":
    logger.info("Starting K3 Container Manager Worker")
    if health_check():
        process_stream()
    else:
        logger.error("Health checks failed, exiting")
        exit(1)