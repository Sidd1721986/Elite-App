#!/usr/bin/env bash
#
# deploy-backend.sh — build the Elite backend, push it to Docker Hub, and roll it
# out to the live Azure App Service. This is the real, working deploy path.
#
#   Usage:   ./deploy-backend.sh
#
# Prereqs (already set up on Sidd's Mac):
#   - Docker Desktop running, logged in to Docker Hub as sidd172
#   - Azure CLI logged in:  az login   (account siddharth172@hotmail.com)
#
# What it does:
#   1. Figures out the next image tag (current prod tag + 1)
#   2. Builds the API for linux/amd64 (App Service is amd64; this Mac is arm64)
#   3. Pushes sidd172/eliteapp-api:<tag>  (and :latest)
#   4. Points eliteapp-api-prod at the new image and restarts it
#   5. Waits for /health to return 200, then prints a one-line rollback command
#
set -euo pipefail

IMAGE="sidd172/eliteapp-api"
WEBAPP="eliteapp-api-prod"
RG="EliteApp-Production-RG"
REGISTRY="https://index.docker.io"
HEALTH_URL="https://${WEBAPP}.azurewebsites.net/health"

cd "$(dirname "$0")"

# --- prerequisite checks ----------------------------------------------------
command -v docker >/dev/null || { echo "❌ docker not found"; exit 1; }
command -v az >/dev/null || { echo "❌ Azure CLI (az) not found"; exit 1; }
docker info >/dev/null 2>&1 || { echo "❌ Docker isn't running — start Docker Desktop"; exit 1; }
az account show >/dev/null 2>&1 || { echo "❌ Not logged in to Azure — run: az login"; exit 1; }

# --- work out the current and next tags -------------------------------------
CURRENT_IMAGE=$(az webapp config container show \
  --name "$WEBAPP" --resource-group "$RG" \
  --query "[?name=='DOCKER_CUSTOM_IMAGE_NAME'].value | [0]" -o tsv 2>/dev/null || echo "")
PREV_TAG="${CURRENT_IMAGE##*:}"
echo "Current live image: ${CURRENT_IMAGE:-<unknown>}  (tag: ${PREV_TAG:-?})"

if [[ "$PREV_TAG" =~ ^[0-9]+$ ]]; then
  NEW_TAG=$(( PREV_TAG + 1 ))
else
  NEW_TAG="$(date +%Y%m%d%H%M)"   # fallback if the current tag isn't numeric
fi
echo "==> Deploying new tag: $NEW_TAG"
echo

# --- build + push -----------------------------------------------------------
echo "==> Building & pushing ${IMAGE}:${NEW_TAG} (linux/amd64)…"
docker buildx build --platform linux/amd64 \
  -t "${IMAGE}:${NEW_TAG}" \
  -t "${IMAGE}:latest" \
  -f backend/Dockerfile backend \
  --push

# --- point the web app at the new image + restart ---------------------------
echo "==> Pointing ${WEBAPP} at ${IMAGE}:${NEW_TAG} and restarting…"
az webapp config container set \
  --name "$WEBAPP" --resource-group "$RG" \
  --container-image-name "${IMAGE}:${NEW_TAG}" \
  --container-registry-url "$REGISTRY" >/dev/null
az webapp restart --name "$WEBAPP" --resource-group "$RG"

# --- health check -----------------------------------------------------------
echo "==> Waiting for ${HEALTH_URL} (cold start can take ~90s)…"
for i in $(seq 1 18); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo "000")
  echo "   attempt $i: HTTP $CODE"
  if [ "$CODE" = "200" ]; then
    echo
    echo "✅ Deployed and healthy: ${IMAGE}:${NEW_TAG}"
    if [[ "$PREV_TAG" =~ ^[0-9]+$ ]]; then
      echo "   Roll back if needed:"
      echo "   az webapp config container set --name $WEBAPP --resource-group $RG --container-image-name ${IMAGE}:${PREV_TAG} --container-registry-url $REGISTRY && az webapp restart --name $WEBAPP --resource-group $RG"
    fi
    exit 0
  fi
  sleep 10
done

echo
echo "⚠️  Health check did not pass after ~3 min. The app may still be starting,"
echo "    or the new image is broken. To roll back to the previous tag:"
echo "    az webapp config container set --name $WEBAPP --resource-group $RG --container-image-name ${IMAGE}:${PREV_TAG} --container-registry-url $REGISTRY && az webapp restart --name $WEBAPP --resource-group $RG"
exit 1
