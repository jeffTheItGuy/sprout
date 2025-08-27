
# Sprout Deployment Guide

## Prerequisites
- Kubernetes cluster with **Traefik** ingress
- **Helm 3.x**
- **Azure Pipelines** with a self-hosted agent in the Default pool
- Access to **GitHub repository**
- Access to **K3s cluster** (Kubeconfig stored as `k3s.yml` in Azure DevOps secure files)

- **Secrets & Variables**
  These should be configured in the `k3s-deployment-vars` variable group:

  * `GHCR_USERNAME`, 
  * `GHCR_TOKEN`
  * `REGISTRY` 
  * `REGISTRY_USER`
  * `DOMAIN`
  * `RELEASE_NAME`
  * `NAMESPACE`
  * `LETSENCRYPT_EMAIL`
  * `REDIS_PASSWORD`
  * `Grafana_USERNAME`
  * `Grafana_PASSWORD`

---

## Deployment Steps

1. **Trigger Pipeline**

   * Manual trigger; pipeline name: `$(Build.SourceBranchName)`

2. **Checkout & Git LFS**

   * Full repo with LFS support
   * Optional backup to GitHub using `temp-backup` branch

3. **Download Kubeconfig**

   * Secure file: `k3s.yml`
   * Set `KUBECONFIG=$(Agent.TempDirectory)/k3s.yml`

4. **Generate BUILD\_TAG**

   ```bash
   BUILD_TAG="$(Build.BuildId)-$(date +%Y%m%d%H%M%S)"
   ```

5. **Verify Cluster Access**

   ```bash
   kubectl get nodes
   ```

6. **Build & Push Docker Images**

   * Frontend, Backend, Worker
   * Tag: `$(BUILD_TAG)`
   * Push to GHCR

7. **Create Redis Secret**

   ```bash
   kubectl create secret generic redis-secret \
     --namespace $(NAMESPACE) \
     --from-literal=redis-password="$(REDIS_PASSWORD)" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

8. **Helm Deployment**

   * Clean up old releases/secrets
   * Create GHCR pull secret
   * Deploy with Helm (`--force --wait`)
   * Enable ingress & SSL, set `ALLOWED_ORIGINS`

9. **Post-Deployment Verification**

   ```bash
   kubectl get all -n $(NAMESPACE)
   kubectl get ingress -n $(NAMESPACE)
   kubectl describe ingress -n $(NAMESPACE)
   ```

   * Confirm images match `BUILD_TAG`
   * Check frontend/API endpoints

10. **Success Message**

* Display `BUILD_TAG`, `DOMAIN`, `NAMESPACE`, `RELEASE_NAME`
* Access: `https://$(DOMAIN)` (frontend), `https://$(DOMAIN)/api` (backend)

