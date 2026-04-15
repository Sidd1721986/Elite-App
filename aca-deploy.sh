#!/bin/bash

# Usage: ./aca-deploy.sh [test|prod]
ENV=${1:-test}
ENV_LOWER=$(echo "$ENV" | tr '[:upper:]' '[:lower:]')
ENV_FILE=".env.aca.${ENV_LOWER}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Configuration file $ENV_FILE not found. Run ./azure-setup-aca.sh first."
    exit 1
fi

# Load configuration
source "$ENV_FILE"

echo "🚀 Starting Deployment to Azure Container Apps [$ENV_LOWER]..."

# 1. Get DB Connection String
# For demo purposes, we fetch it or reconstruct it.
# In a real pipeline, this would come from a secure variable.
DB_HOST=$(az postgres flexible-server show --name $DB_SERVER_NAME --resource-group $RG_NAME --query "fullyQualifiedDomainName" -o tsv)
DB_USER="eliteadmin"
if [ -z "$AZURE_DB_PASSWORD" ]; then
    read -rs -p "Enter the DB password (for $DB_USER): " AZURE_DB_PASSWORD
    echo ""
fi

CONN_STRING="Host=$DB_HOST;Port=5432;Database=elite_db;Username=$DB_USER;Password=$AZURE_DB_PASSWORD;SslMode=Require;Trust Server Certificate=true"

# 2. Build and Push Image (using Azure Cloud Build)
echo "🔨 Building Docker Image in the cloud (ACR Build)..."
IMAGE_NAME="eliteapp-api:latest"
IMAGE_FULL_PATH="$ACR_NAME.azurecr.io/$IMAGE_NAME"

# This command sends your code to Azure and builds it there.
az acr build --registry $ACR_NAME --image $IMAGE_NAME ./backend

# 3. Update Container App
echo "🆙 Updating Container App with new image and environment variables..."

# SECURITY: Ensure secrets are provided via environment variables or a secure .env.secrets file
# DO NOT hardcode secrets in this script.
if [ -z "$JWT_KEY" ] || [ -z "$PASSWORD_PEPPER" ]; then
    echo "⚠️  Warning: JWT_KEY or PASSWORD_PEPPER are not set in the environment."
    echo "Using default/demo values. FOR PRODUCTION, set these in your terminal or .env.aca.prod."
    JWT_KEY=${JWT_KEY:-"supersecretsupersecretsupersecret123!"}
    PASSWORD_PEPPER=${PASSWORD_PEPPER:-"EliteAppSecurePepper2026!#"}
fi

# Get the FQDN for the AllowedHosts check
APP_FQDN=$(az containerapp show --name $ACA_APP_NAME --resource-group $RG_NAME --query "properties.configuration.ingress.fqdn" -o tsv)

# For production, replace * with your specific frontend domain (e.g. mobileapp.elite.com)
CORS_ORIGINS=${CORS_ORIGINS:-"*"}

# Note: We set secrets first, then reference them in env vars
echo "🔐 Syncing secrets to Key Vault and Container App..."

# Upload sensitive secrets to Key Vault if provided (optional, fallback to previous values if existing)
if [ ! -z "$JWT_KEY" ]; then
    az keyvault secret set --vault-name $KEYVAULT_NAME --name "jwt-key" --value "$JWT_KEY" --output none
fi
if [ ! -z "$PASSWORD_PEPPER" ]; then
    az keyvault secret set --vault-name $KEYVAULT_NAME --name "password-pepper" --value "$PASSWORD_PEPPER" --output none
fi

# Link ACA to Key Vault secrets using Managed Identity
az containerapp secret set \
    --name $ACA_APP_NAME \
    --resource-group $RG_NAME \
    --secrets \
        "db-conn-string=$CONN_STRING" \
        "jwt-key=keyvaultref:${KEYVAULT_URL}secrets/jwt-key,identityref:system" \
        "password-pepper=keyvaultref:${KEYVAULT_URL}secrets/password-pepper,identityref:system"

az containerapp update \
    --name $ACA_APP_NAME \
    --resource-group $RG_NAME \
    --image $IMAGE_FULL_PATH \
    --set-env-vars \
        "ConnectionStrings__DefaultConnection=secretref:db-conn-string" \
        "Jwt__Key=secretref:jwt-key" \
        "PasswordReset__Pepper=secretref:password-pepper" \
        "ASPNETCORE_ENVIRONMENT=Production" \
        "AllowedHosts=$APP_FQDN" \
        "Cors__AllowedOrigins=$CORS_ORIGINS" \
        "ApplicationInsights__InstrumentationKey=$AI_INSTRUMENTATION_KEY" \
        "Email__FromAddress=no-reply@eliteapp.com" \
        "DEPLOY_TIMESTAMP=$(date +%s)"

echo "✅ Deployment Complete!"
echo "🔗 Your API is available at: https://$(az containerapp show --name $ACA_APP_NAME --resource-group $RG_NAME --query 'properties.configuration.ingress.fqdn' -o tsv)"
echo "💡 Tip: The app will now scale to zero when idle. The first request might take a few seconds to wake it up."
