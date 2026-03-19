#!/bin/bash

# Usage: ./azure-setup.sh [test|prod]
ENV=${1:-test}
ENV_LOWER=$(echo "$ENV" | tr '[:upper:]' '[:lower:]')

if [[ "$ENV_LOWER" != "test" && "$ENV_LOWER" != "prod" ]]; then
    echo "❌ Invalid environment. Please use 'test' or 'prod'."
    exit 1
fi

# Configuration
PROJECT_NAME="eliteapp"
UNIQUE_ID=$(date +%s | cut -c 6-10) # 5 unique digits
RG_NAME="EliteApp-${ENV_LOWER}-RG"
LOCATION="eastus2" 
ACR_NAME="${PROJECT_NAME}reg${ENV_LOWER}${UNIQUE_ID}"
APP_SERVICE_PLAN="${PROJECT_NAME}-plan-${ENV_LOWER}"
APP_NAME="${PROJECT_NAME}-app-${ENV_LOWER}-${UNIQUE_ID}"
DB_SERVER_NAME="${PROJECT_NAME}-db-${ENV_LOWER}-${UNIQUE_ID}"
DB_NAME="elite_db"
KEYVAULT_NAME="${PROJECT_NAME}-kv-${ENV_LOWER}-${UNIQUE_ID}"

echo "🚀 Starting Azure Infrastructure Setup for [$ENV_LOWER]..."

# 0. Register necessary resource providers
echo "📜 Registering Azure Resource Providers..."
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.DBforPostgreSQL

# 1. Create Resource Group
echo "🏗️ Creating Resource Group: $RG_NAME in $LOCATION"
az group create --name $RG_NAME --location $LOCATION

# 2. Create Azure Container Registry (ACR)
echo "📦 Creating Container Registry: $ACR_NAME"
az acr create --resource-group $RG_NAME --name $ACR_NAME --sku Basic

# 3. Create Azure Database for PostgreSQL
echo "🗄️ Creating PostgreSQL Flexible Server: $DB_SERVER_NAME"
az postgres flexible-server create \
    --resource-group $RG_NAME \
    --name $DB_SERVER_NAME \
    --location $LOCATION \
    --database-name $DB_NAME \
    --admin-user eliteadmin \
    --admin-password "P@ssw0rd123!" \
    --sku-name Standard_B1ms \
    --tier Burstable \
    --yes

# 4. Create Azure Key Vault
echo "🔐 Creating Key Vault: $KEYVAULT_NAME"
az keyvault create --name $KEYVAULT_NAME --resource-group $RG_NAME --location $LOCATION

# 5. Create App Service Plan
echo "💾 Creating App Service Plan..."
az appservice plan create --name $APP_SERVICE_PLAN --resource-group $RG_NAME --is-linux --sku B1

# 6. Create Web App for Containers
echo "🌐 Creating Web App: $APP_NAME"
az webapp create --resource-group $RG_NAME --plan $APP_SERVICE_PLAN --name $APP_NAME --deployment-container-image-name "$ACR_NAME.azurecr.io/eliteapp-api:latest"

# Save environment configuration for deployment
ENV_FILE=".env.${ENV_LOWER}"
echo "Saving configuration to $ENV_FILE"
cat <<EOF > $ENV_FILE
ACR_NAME="$ACR_NAME"
RG_NAME="$RG_NAME"
APP_NAME="$APP_NAME"
EOF

echo "✅ Infrastructure provisioned for $ENV_LOWER!"
echo "------------------------------------------------"
echo "Next step: Run './docker-deploy.sh $ENV_LOWER' to push your image."
echo "------------------------------------------------"
