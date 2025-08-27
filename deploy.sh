#!/bin/bash
set -euo pipefail

export KUBECONFIG=$HOME/.kube/config

# ✅ Create namespace first
echo "🔧 Ensuring namespace 'sprout' exists..."
kubectl create namespace sprout --dry-run=client -o yaml | kubectl apply -f -

# Set context
kubectl config set-context --current --namespace=sprout

# Build images
echo "🔨 Building Docker images..."
docker build -t backend:prod -f .docker/prod/prodbackend.Dockerfile .
docker build -t frontend:prod -f .docker/prod/prodfrontend.Dockerfile .
docker build -t worker:prod -f .docker/prod/prodworker.Dockerfile .

# Import into k3s
echo "📦 Importing images into K3s..."
docker save backend:prod | sudo k3s ctr images import -
docker save frontend:prod | sudo k3s ctr images import -
docker save worker:prod | sudo k3s ctr images import -

# ✅ Now safe to create secret
echo "🔑 Creating redis secret..."
kubectl create secret generic redis-secret \
  --from-literal=redis-password=yourStrongPassword \
  --namespace=sprout \
  --save-config --dry-run=client -o yaml | kubectl apply -f -

# Helm install
echo "🚀 Installing/Upgrading Helm chart..."
helm upgrade --install my-release .helm/helm-local \
  --namespace=sprout \
  --create-namespace \
  --values ./helm/values.yaml


# === WAIT FOR DEPLOYMENTS ===
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/frontend -n sprout || true
kubectl wait --for=condition=available --timeout=120s deployment/backend -n sprout || true

# === SETUP DNS ===
echo "🌐 Configuring local DNS..."

declare -a HOSTS=("sprout.local" )

NODE_IP=$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
if [ -z "$NODE_IP" ]; then
  echo "❌ Could not get node IP"
  exit 1
fi

for HOST in "${HOSTS[@]}"; do
  sudo sed -i.bak "/$HOST/d" /etc/hosts 2>/dev/null || true
  echo "$NODE_IP $HOST" | sudo tee -a /etc/hosts > /dev/null
  echo "✅ $HOST → $NODE_IP"
done

# === FINAL MESSAGE ===
echo ""
echo " Deployment complete!"
echo " Access your apps at:"
echo "    Frontend: http://sprout.local"
echo "    Backend:  http://sprout.local/api"
echo ""
echo " Tip: Share this IP with others on your network:"
echo "   They can add '$NODE_IP frontend.sprout.local api.sprout.local' to their /etc/hosts"
echo ""
echo "  To rollback: ./rollback.sh"