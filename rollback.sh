#!/bin/bash
echo "🗑️  Rolling back..."

helm uninstall my-release -n sprout
kubectl delete namespace sprout
sudo sed -i.bak "/sprout.local/d" /etc/hosts
echo "✅ Rollback complete"