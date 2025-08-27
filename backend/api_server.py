from fastapi import FastAPI, HTTPException, Request, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
import uuid
import os
from datetime import datetime, timedelta
from pydantic import BaseModel

app = FastAPI(root_path="/api")

# === DO NOT CHANGE CORS ===
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8080,http://sprout.local"
)
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Redis Setup
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_password = os.getenv("REDIS_PASSWORD")

try:
    r = redis.Redis(
        host=redis_host,
        port=6379,
        db=0,
        password=redis_password,
        socket_connect_timeout=50,
        socket_timeout=50,
        retry_on_timeout=True,
        decode_responses=True  # Automatically decode responses to str
    )
    r.ping()
    print(f"✓ Connected to Redis at {redis_host}")
except redis.ConnectionError as e:
    print(f"✗ Failed to connect to Redis at {redis_host}: {e}")
    raise

# Security Config 
MAX_CONTAINERS = 3
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_WINDOW = 900  # 15 minutes in seconds
API_KEY = os.getenv("API_KEY", "demo123")  # Change in production!

#  Helper: Rate Limiting 
def rate_limit(ip: str, max_req: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW):
    key = f"ratelimit:{ip}"
    current = r.get(key)
    if current is None:
        r.setex(key, window, 1)
        return True
    elif int(current) < max_req:
        r.incr(key)
        return True
    return False

# Helper: API Key Check
def require_api_key(request: Request):
    key = request.headers.get("X-API-Key")
    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
    return key

#  CAPTCHA Token Flow 
@app.post("/captcha/request")
async def request_captcha():
    """Frontend calls this to get a fresh CAPTCHA token"""
    token = str(uuid.uuid4())
    r.setex(f"captcha:{token}", 300, "valid")  # 5-minute expiry
    return {"captcha_token": token}

@app.post("/captcha/verify/{token}")
async def verify_captcha(token: str):
    """Verify CAPTCHA token (called by frontend after slider)"""
    key = f"captcha:{token}"
    if r.get(key):
        r.delete(key)  
        return {"verified": True}
    raise HTTPException(status_code=400, detail="Invalid or expired CAPTCHA token")

# Models
class Container(BaseModel):
    name: str = None
    image: str = "nginx:latest"

# Apply Rate Limiting to All API Routes 
@app.middleware("http")
async def add_rate_limit(request: Request, call_next):
    # apply to /api/ routes
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host

        # Skip rate limit for health check
        if request.url.path == "/api/health":
            return await call_next(request)

        # Enforce rate limit
        if not rate_limit(client_ip, max_req=RATE_LIMIT_REQUESTS, window=RATE_LIMIT_WINDOW):
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_WINDOW//60} minutes."
            )

    response = await call_next(request)
    return response

# New Endpoint: Get Rate Limit Status
@app.get("/rate-limit")
async def get_rate_limit(request: Request):
    """
    Returns current rate limit usage for the client IP.
    Used by frontend to display remaining requests.
    """
    client_ip = request.client.host
    key = f"ratelimit:{client_ip}"
    current = r.get(key)
    ttl = r.ttl(key)

    remaining = RATE_LIMIT_REQUESTS - (int(current) if current else 0)
    reset_in_seconds = ttl if ttl > 0 else 0

    return {
        "limit": RATE_LIMIT_REQUESTS,
        "remaining": max(0, remaining),
        "reset_in_seconds": reset_in_seconds,
        "window": RATE_LIMIT_WINDOW,
        "namespace": "sprout"
    }

# POST /containers - Requires CAPTCHA Token
@app.post("/containers")
async def create_container(
    container: Container = None,
    api_key: str = Depends(require_api_key),
    captcha_token: str = Body(..., embed=True)
):
    """Create container only if CAPTCHA passed and under limit"""
    try:
        r.ping()

        # 1. Verify CAPTCHA token
        captcha_key = f"captcha:{captcha_token}"
        if not r.get(captcha_key):
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired CAPTCHA token. Please try again."
            )
        r.delete(captcha_key)  # One-time use
        print(f"✅ CAPTCHA token {captcha_token} verified and consumed")

        # 2. Count running containers
        container_keys = r.keys("container:*")
        running_count = 0
        for key in container_keys:
            status = r.hget(key, "status")
            if status in ["running", "pending"]:
                running_count += 1

        if running_count >= MAX_CONTAINERS:
            raise HTTPException(
                status_code=429,
                detail=f"Too many containers running ({running_count}/{MAX_CONTAINERS}). Delete one first."
            )

        # 3. Generate container
        container_id = str(uuid.uuid4())
        created_at = datetime.utcnow().isoformat() + 'Z'
        name = container.name if container and container.name else f"container-{container_id[:8]}"
        image = container.image if container else "nginx:latest"

        # 4. Publish to Redis stream
        event_id = r.xadd(
            "container_events",
            fields={
                "event_type": "container_created",
                "container_id": container_id,
                "name": name,
                "image": image,
                "created_at": created_at
            },
            maxlen=1000
        )

        # 5. Store container state with TTL
        container_key = f"container:{container_id}"
        r.hset(
            container_key,
            mapping={
                "id": container_id,
                "name": name,
                "image": image,
                "status": "pending",
                "created_at": created_at
            }
        )
        r.expire(container_key, timedelta(hours=24))  # Auto cleanup

        print(f"✓ Created container {container_id}")
        return {
            "id": container_id,
            "name": name,
            "image": image,
            "created_at": created_at,
            "status": "pending",
            "namespace": "sprout"
        }

    except HTTPException:
        raise
    except redis.ConnectionError as e:
        print(f"✗ Redis error: {e}")
        raise HTTPException(status_code=503, detail="Redis service unavailable")
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# DELETE /containers/{id} - Requires CAPTCHA Token 
@app.delete("/containers/{container_id}")
async def delete_container(
    container_id: str,
    api_key: str = Depends(require_api_key),
    captcha_token: str = Body(..., embed=True)
):
    """Delete container only if CAPTCHA token is valid"""
    try:
        r.ping()

        # 1. Verify CAPTCHA token
        captcha_key = f"captcha:{captcha_token}"
        if not r.get(captcha_key):
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired CAPTCHA token."
            )
        r.delete(captcha_key)  # One-time use
        print(f"✅ CAPTCHA token {captcha_token} verified for deletion")

        # 2. Proceed with deletion
        container_key = f"container:{container_id}"
        container_exists = r.exists(container_key)

        event_id = r.xadd(
            "container_events",
            fields={
                "event_type": "container_deleted",
                "container_id": container_id,
                "deleted_at": datetime.utcnow().isoformat()
            },
            maxlen=1000
        )

        return {
            "message": f"Container {container_id} deletion requested",
            "event_id": event_id,
            "container_existed": bool(container_exists),
            "namespace": "sprout"
        }

    except HTTPException:
        raise
    except redis.ConnectionError as e:
        raise HTTPException(status_code=503, detail="Redis service unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete container: {str(e)}")


#  GET /containers - List all containers 
@app.get("/containers")
async def list_containers():
    try:
        r.ping()
        container_keys = r.keys("container:*")
        containers = []
        for key in container_keys:
            data = r.hgetall(key)
            if data:
                data["namespace"] = "sprout"
                containers.append(data)
        return containers
    except redis.ConnectionError:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    except Exception as e:
        print(f"Error listing containers: {e}")
        return []


# Health Check 
@app.get("/health")
async def health_check():
    try:
        r.ping()
        return {"status": "healthy", "redis": "connected", "namespace": "sprout"}
    except Exception as e:
        return {"status": "unhealthy", "redis": "disconnected", "error": str(e)}


# Debug: Container Info
@app.get("/debug/container/{container_id}")
async def debug_container(container_id: str):
    try:
        r.ping()
        data = r.hgetall(f"container:{container_id}")
        redis_info = {k: v for k, v in data.items()} if data else None
        if redis_info:
            redis_info["namespace"] = "sprout"
        return {
            "container_id": container_id,
            "redis_data": redis_info,
            "namespace": "sprout"
        }
    except Exception as e:
        return {"error": str(e), "namespace": "sprout"}


# Debug: Stream Info
@app.get("/debug/stream")
async def debug_stream():
    try:
        r.ping()
        info = r.xinfo_stream("container_events")
        return {
            "stream_info": info,
            "namespace": "sprout"
        }
    except Exception as e:
        return {"error": str(e), "namespace": "sprout"}


# Run Server 
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)