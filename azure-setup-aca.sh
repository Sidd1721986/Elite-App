#!/bin/bash

# Usage: ./azure-setup-aca.sh [test|prod]
ENV=${1:-test}
ENV_LOWER=$(echo "$ENV" | tr '[:upper:]' '[:lower:]')

if [[ "$ENV_LOWER" != "test" && "$ENV_LOWER" != "prod" ]]; then
    echo "❌ Invalid environment. Please use 'test' or 'prod'."
    exit 1
fi

# Configuration
PROJECT_NAME="eliteapp"
UNIQUE_ID=$(date +%s | cut -c 6-10)
RG_NAME="EliteApp-${ENV_LOWER}-ACA-RG" # Separate RG for ACA to keep it clean
LOCATION="eastus2" 
ACR_NAME="${PROJECT_NAME}reg${ENV_LOWER}${UNIQUE_ID}" # Usually reusing existing ACR is better, but this script mirrors azure-setup.sh
ACA_ENV_NAME="${PROJECT_NAME}-env-${ENV_LOWER}"
ACA_APP_NAME="${PROJECT_NAME}-api-${ENV_LOWER}"
DB_SERVER_NAME="${PROJECT_NAME}-db-aca-${ENV_LOWER}-${UNIQUE_ID}"
DB_NAME="elite_db"

echo "🚀 Starting Azure Container Apps (Serverless) Setup for [$ENV_LOWER]..."

# 0. Register/Update Extensions
echo "📜 Ensuring Azure Container Apps extension is installed..."
az extension add --name containerapp --upgrade -y

# 1. Create Resource Group
echo "🏗️ Creating Resource Group: $RG_NAME"
az group create --name $RG_NAME --location $LOCATION

# 2. Create ACR (If not already provided)
echo "📦 Creating Container Registry: $ACR_NAME"
az acr create --resource-group $RG_NAME --name $ACR_NAME --sku Basic

# 3. Create Database (Flexible Server)
echo "🗄️ Creating PostgreSQL Flexible Server..."
if [ -z "$AZURE_DB_PASSWORD" ]; then
    read -rs -p "Enter a SECURE password for the DB Admin (eliteadmin): " AZURE_DB_PASSWORD
    echo ""
fi

az postgres flexible-server create \
    --resource-group $RG_NAME \
    --name $DB_SERVER_NAME \
    --location $LOCATION \
    --database-name $DB_NAME \
    --admin-user eliteadmin \
    --admin-password "$AZURE_DB_PASSWORD" \
    --sku-name Standard_B1ms \
    --tier Burstable \
    --yes

# 4. Create Azure Key Vault (Secrets Management)
KEYVAULT_NAME="${PROJECT_NAME}-kv-${ENV_LOWER}-${UNIQUE_ID}"
echo "🔐 Creating Key Vault: $KEYVAULT_NAME"
az keyvault create --name $KEYVAULT_NAME --resource-group $RG_NAME --location $LOCATION
KV_URL=$(az keyvault show --name $KEYVAULT_NAME --query "properties.vaultUri" -o tsv)

# 5. Create Application Insights (Monitoring)
echo "📊 Creating Application Insights: ${PROJECT_NAME}-ai-${ENV_LOWER}"
# Ensure the workspace-based Application Insights is used (requires workspace)
# For simplicity in this script, we use a standard component.
az extension add --name application-insights -y
az monitor app-insights component create \
    --app "${PROJECT_NAME}-ai-${ENV_LOWER}" \
    --location $LOCATION \
    --resource-group $RG_NAME \
    --application-type web \
    --kind web

AI_KEY=$(az monitor app-insights component show --app "${PROJECT_NAME}-ai-${ENV_LOWER}" --resource-group $RG_NAME --query "instrumentationKey" -o tsv)

# 5. Create Container Apps Environment
echo "🌐 Creating Container Apps Environment: $ACA_ENV_NAME"
az containerapp env create \
    --name $ACA_ENV_NAME \
    --resource-group $RG_NAME \
    --location $LOCATION

# 6. Create the Container App (Scaling 0-10)
echo "🚀 Deploying Container App: $ACA_APP_NAME"
# For production, set MIN_REPLICAS to 1 to avoid "Cold Start" delays.
# For testing/demo, we use 0 to save costs.
MIN_REPLICAS=0 
MAX_REPLICAS=10

# We create it with a "hello world" or the latest image if available.
# We also enable Managed Identity for ACR pulls.
az containerapp create \
    --name $ACA_APP_NAME \
    --resource-group $RG_NAME \
    --environment $ACA_ENV_NAME \
    --image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" \
    --target-port 5260 \
    --ingress 'external' \
    --min-replicas $MIN_REPLICAS \
    --max-replicas $MAX_REPLICAS \
    --system-assigned

# 6. Assign AcrPull permissions to the App Identity
echo "🔐 Configuring Managed Identity permissions for ACR..."
APP_ID=$(az containerapp show --name $ACA_APP_NAME --resource-group $RG_NAME --query "identity.principalId" -o tsv)
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RG_NAME --query "id" -o tsv)

# Wait a few seconds for identity propagation
sleep 10
az role assignment create \
    --assignee $APP_ID \
    --role "AcrPull" \
    --scope $ACR_ID

# 7. Configure ACR pull using Managed Identity (No password needed!)
az containerapp registry set \
  --name $ACA_APP_NAME \
  --resource-group $RG_NAME \
  --server "$ACR_NAME.azurecr.io" \
  --identity system

# 8. Grant Key Vault access to the App Identity
echo "🔑 Granting Key Vault Secrets User role to the App Identity..."
az role assignment create \
    --assignee $APP_ID \
    --role "Key Vault Secrets User" \
    --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG_NAME/providers/Microsoft.KeyVault/vaults/$KEYVAULT_NAME"

# Save configuration
ENV_FILE=".env.aca.${ENV_LOWER}"
echo "Saving configuration to $ENV_FILE"
cat <<EOF > $ENV_FILE
ACR_NAME="$ACR_NAME"
RG_NAME="$RG_NAME"
ACA_APP_NAME="$ACA_APP_NAME"
DB_SERVER_NAME="$DB_SERVER_NAME"
AI_INSTRUMENTATION_KEY="$AI_KEY"
KEYVAULT_NAME="$KEYVAULT_NAME"
KEYVAULT_URL="$KV_URL"
EOF

echo "✅ ACA Infrastructure provisioned!"
echo "------------------------------------------------"
echo "Next steps:"
echo "1. Push your real image to the new ACR: $ACR_NAME.azurecr.io"
echo "2. Run './aca-deploy.sh $ENV_LOWER' to update the app with your code and env vars."
echo "------------------------------------------------"
