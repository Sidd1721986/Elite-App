#!/bin/bash

# Usage: ./docker-deploy.sh [test|prod]
ENV=${1:-test}
ENV_LOWER=$(echo "$ENV" | tr '[:upper:]' '[:lower:]')
ENV_FILE=".env.${ENV_LOWER}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Configuration file $ENV_FILE not found. Please run ./azure-setup.sh $ENV_LOWER first."
    exit 1
fi

# Load configuration
source "$ENV_FILE"

IMAGE_NAME="eliteapp-api"
TAG=$(date +%Y%m%d%H%M%S)

AZ_PATH="/opt/homebrew/bin/az"
DOCKER_PATH="/usr/local/bin/docker"

echo "📦 Building and Pushing Docker Image to Azure [$ENV_LOWER]..."

# Login to ACR
$AZ_PATH acr login --name $ACR_NAME

# Build the image
$DOCKER_PATH build -t $IMAGE_NAME ./backend

# Tag with latest and timestamp for backup/versioning
$DOCKER_PATH tag $IMAGE_NAME "$ACR_NAME.azurecr.io/$IMAGE_NAME:latest"
$DOCKER_PATH tag $IMAGE_NAME "$ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG"

# Push to ACR
$DOCKER_PATH push "$ACR_NAME.azurecr.io/$IMAGE_NAME:latest"
$DOCKER_PATH push "$ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG"

# Update Web App to use the new image
echo "🚀 Updating Web App $APP_NAME..."
$AZ_PATH webapp config container set --name $APP_NAME --resource-group $RG_NAME \
    --docker-custom-image-name "$ACR_NAME.azurecr.io/$IMAGE_NAME:latest"

echo "✨ Image pushed and App updated successfully for $ENV_LOWER!"
echo "Version Tag: $TAG"
