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

# Small retry wrapper — `az` occasionally drops the connection mid-call.
retry() {
  local n=0
  until "$@"; do
    n=$((n+1))
    if [ "$n" -ge 4 ]; then echo "   (command failed after $n attempts)"; return 1; fi
    echo "   transient error — retrying ($n)…"; sleep 5
  done
}

# --- preflight: required app settings ----------------------------------------
# The API fails closed in Production without durable upload storage. This app uses the
# App Service /home share (no extra Azure resources): Storage__LocalPath under /home plus
# WEBSITES_ENABLE_APP_SERVICE_STORAGE=true (mounts the persistent share into the container).
echo "==> Checking required App Service settings…"
SETTINGS=$(az webapp config appsettings list --name "$WEBAPP" --resource-group "$RG" -o json)
HAS_PATH=$(echo "$SETTINGS" | python3 -c "import json,sys; s={x['name']:x['value'] for x in json.load(sys.stdin)}; print(1 if s.get('Storage__LocalPath','').startswith('/home/') and s.get('WEBSITES_ENABLE_APP_SERVICE_STORAGE','').lower()=='true' else 0)")
HAS_BLOB=$(echo "$SETTINGS" | python3 -c "import json,sys; s={x['name'] for x in json.load(sys.stdin)}; print(1 if 'Storage__BlobConnectionString' in s else 0)")
if [ "$HAS_PATH" != "1" ] && [ "$HAS_BLOB" != "1" ]; then
  echo "❌ Durable upload storage is not configured on ${WEBAPP} — the new image will refuse to start."
  echo "   Set it first (uses the existing App Service plan, no new resources):"
  echo "   az webapp config appsettings set --name $WEBAPP --resource-group $RG --settings Storage__LocalPath=/home/data/uploads WEBSITES_ENABLE_APP_SERVICE_STORAGE=true"
  exit 1
fi

# --- apply EF migrations before rolling the container ------------------------
# Preferred path for scale-out safety: migrate once from here, not at instance boot.
# If the prod DB isn't reachable from this machine (firewall), we warn and fall back to
# the app's startup migration (Database__RunMigrations defaults to true).
echo "==> Applying EF migrations to the production database…"
PROD_CONN=$(az webapp config appsettings list --name "$WEBAPP" --resource-group "$RG" \
  --query "[?name=='ConnectionStrings__DefaultConnection'].value | [0]" -o tsv)
if [ -z "$PROD_CONN" ]; then
  PROD_CONN=$(az webapp config connection-string list --name "$WEBAPP" --resource-group "$RG" \
    --query "[?name=='DefaultConnection'].value | [0]" -o tsv 2>/dev/null || echo "")
fi
if [ -n "$PROD_CONN" ] && (cd backend && dotnet ef database update --connection "$PROD_CONN" >/dev/null 2>&1); then
  echo "   ✅ migrations applied from deploy machine"
else
  echo "   ⚠️  could not migrate from here (DB firewall or missing conn string) —"
  echo "       relying on startup migration inside the container (fine for a single instance;"
  echo "       do NOT scale out until migrations run out-of-band)."
fi

# --- point the web app at the new image + restart ---------------------------
echo "==> Pointing ${WEBAPP} at ${IMAGE}:${NEW_TAG} and restarting…"
retry az webapp config container set \
  --name "$WEBAPP" --resource-group "$RG" \
  --container-image-name "${IMAGE}:${NEW_TAG}" \
  --container-registry-url "$REGISTRY" >/dev/null
retry az webapp restart --name "$WEBAPP" --resource-group "$RG"

# --- platform health probing + always-on (idempotent) ------------------------
# Azure ignores the Docker HEALTHCHECK; the App Service health-check path is what lets the
# load balancer stop routing to a sick instance. Always On prevents idle unload.
retry az webapp config set --name "$WEBAPP" --resource-group "$RG" \
  --generic-configurations '{"healthCheckPath": "/health", "alwaysOn": true}' >/dev/null

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
