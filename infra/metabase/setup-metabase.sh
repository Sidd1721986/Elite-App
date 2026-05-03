#!/usr/bin/env bash
# =============================================================================
# Elite App — Metabase Analytics Setup  (ZERO COST)
# =============================================================================
# What this provisions:
#   1. Read-only PostgreSQL user on your EXISTING prod DB  → $0
#   2. Metabase container on Azure Container Apps          → $0 (ACA free tier)
#      Metabase uses H2 embedded storage for its own metadata
#      (no extra PostgreSQL server needed)
#
# What it does NOT create:
#   - No read replica        (saves ~$13/month)
#   - No metadata DB server  (saves ~$13/month)
#
# Prerequisites:
#   - Azure CLI logged in:  az login
#   - Correct subscription: az account set --subscription <id>
#   - psql installed:       brew install libpq && export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
#   - DB_PASSWORD env var set (your prod DB admin password — eliteadmin)
#   - ANALYTICS_READER_PASSWORD env var set (choose any password for the new read-only user)
#
# Usage:
#   export DB_PASSWORD="your-prod-db-admin-password"
#   export ANALYTICS_READER_PASSWORD="choose-any-password"
#   chmod +x infra/metabase/setup-metabase.sh
#   ./infra/metabase/setup-metabase.sh
# =============================================================================

set -euo pipefail

# ── Existing prod resources (no changes to these) ─────────────────────────────
PROD_RG="EliteApp-Production-RG"
PROD_DB_SERVER="eliteapp-db-prod-71412"
PROD_DB_HOST="${PROD_DB_SERVER}.postgres.database.azure.com"
PROD_DB_NAME="elite_db"
PROD_DB_ADMIN="eliteadmin"
LOCATION="eastus2"

# ── New analytics resources (all free) ───────────────────────────────────────
ANALYTICS_RG="EliteApp-Analytics-RG"
ACA_ENV_NAME="eliteapp-analytics-env"
METABASE_APP_NAME="eliteapp-metabase"
ANALYTICS_DB_USER="analytics_reader"   # read-only user we'll create
METABASE_PORT=3000

# ── Validate required env vars ────────────────────────────────────────────────
if [[ -z "${DB_PASSWORD:-}" ]]; then
  echo "❌  DB_PASSWORD is not set (prod DB admin password for eliteadmin)."
  exit 1
fi
if [[ -z "${ANALYTICS_READER_PASSWORD:-}" ]]; then
  echo "❌  ANALYTICS_READER_PASSWORD is not set (password for new read-only user)."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Elite App — Metabase Analytics  (Zero Cost Setup)          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Prod DB (existing)  : $PROD_DB_HOST"
echo "  New read-only user  : $ANALYTICS_DB_USER"
echo "  Metabase app        : $METABASE_APP_NAME"
echo "  Metabase storage    : H2 embedded (no extra DB server)"
echo "  Estimated cost      : \$0 / month"
echo ""

# ── 1. Register extensions ────────────────────────────────────────────────────
echo "📜 [1/5] Ensuring Azure Container Apps extension is installed..."
az extension add --name containerapp --upgrade --yes 2>/dev/null || true

# ── 2. Create read-only PostgreSQL user on existing prod DB ───────────────────
echo ""
echo "👤 [2/5] Creating read-only user '$ANALYTICS_DB_USER' on prod DB..."
echo "    Connecting to: $PROD_DB_HOST"
echo ""

# Allow Azure services to reach the prod DB (firewall rule — 0.0.0.0 = Azure internal)
az postgres flexible-server firewall-rule create \
  --resource-group "$PROD_RG" \
  --name "$PROD_DB_SERVER" \
  --rule-name "AllowAzureServices" \
  --start-ip-address "0.0.0.0" \
  --end-ip-address "0.0.0.0" \
  2>/dev/null || echo "    (firewall rule already exists — skipping)"

# Create the read-only role via psql
PGPASSWORD="$DB_PASSWORD" psql \
  "host=${PROD_DB_HOST} port=5432 dbname=${PROD_DB_NAME} user=${PROD_DB_ADMIN} sslmode=require" \
  <<SQL
-- Create read-only analytics user (safe to re-run — DO NOTHING if exists)
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${ANALYTICS_DB_USER}') THEN
    CREATE ROLE ${ANALYTICS_DB_USER}
      WITH LOGIN
      PASSWORD '${ANALYTICS_READER_PASSWORD}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    RAISE NOTICE 'Created role: ${ANALYTICS_DB_USER}';
  ELSE
    -- Update password in case it changed
    ALTER ROLE ${ANALYTICS_DB_USER} WITH PASSWORD '${ANALYTICS_READER_PASSWORD}';
    RAISE NOTICE 'Role already exists — updated password: ${ANALYTICS_DB_USER}';
  END IF;
END
\$\$;

-- Grant access to the database
GRANT CONNECT ON DATABASE ${PROD_DB_NAME} TO ${ANALYTICS_DB_USER};

-- Grant read-only access to all current tables in public schema
GRANT USAGE ON SCHEMA public TO ${ANALYTICS_DB_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ANALYTICS_DB_USER};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ANALYTICS_DB_USER};

-- Automatically grant SELECT on any NEW tables created in future
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO ${ANALYTICS_DB_USER};

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO ${ANALYTICS_DB_USER};

SELECT 'Read-only user ready: ${ANALYTICS_DB_USER}' AS status;
SQL

echo "    ✅ Read-only user '$ANALYTICS_DB_USER' created on $PROD_DB_HOST"

# ── 3. Create Analytics Resource Group ───────────────────────────────────────
echo ""
echo "🏗️  [3/5] Creating Analytics Resource Group: $ANALYTICS_RG"
az group create \
  --name "$ANALYTICS_RG" \
  --location "$LOCATION" \
  --output table

# ── 4. Create Container Apps Environment ─────────────────────────────────────
echo ""
echo "🌐 [4/5] Creating Container Apps Environment: $ACA_ENV_NAME"
az containerapp env create \
  --name "$ACA_ENV_NAME" \
  --resource-group "$ANALYTICS_RG" \
  --location "$LOCATION"

# ── 5. Deploy Metabase container ──────────────────────────────────────────────
echo ""
echo "🚀 [5/5] Deploying Metabase container: $METABASE_APP_NAME"
echo "    Image  : metabase/metabase:latest"
echo "    Storage: H2 embedded (no separate DB server)"
echo "    Reads  : elite_db via read-only user '$ANALYTICS_DB_USER'"
echo ""

az containerapp create \
  --name "$METABASE_APP_NAME" \
  --resource-group "$ANALYTICS_RG" \
  --environment "$ACA_ENV_NAME" \
  --image "metabase/metabase:latest" \
  --target-port "$METABASE_PORT" \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 0 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    "MB_DB_TYPE=h2" \
    "MB_SITE_NAME=Elite App Analytics" \
    "MB_ANONYMOUS_TRACKING_ENABLED=false" \
    "JAVA_TIMEZONE=America/New_York"

# min-replicas=0 means container sleeps when not in use → zero cost when idle

METABASE_URL=$(az containerapp show \
  --name "$METABASE_APP_NAME" \
  --resource-group "$ANALYTICS_RG" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

# ── Save config ───────────────────────────────────────────────────────────────
cat <<EOF > .env.analytics
ANALYTICS_RG="$ANALYTICS_RG"
METABASE_APP_NAME="$METABASE_APP_NAME"
METABASE_URL="https://${METABASE_URL}"
ANALYTICS_DB_HOST="$PROD_DB_HOST"
ANALYTICS_DB_NAME="$PROD_DB_NAME"
ANALYTICS_DB_USER="$ANALYTICS_DB_USER"
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║   ✅  Metabase Analytics Stack is LIVE  —  \$0/month                 ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║                                                                      ║"
echo "║   Metabase URL  : https://${METABASE_URL}"
echo "║                                                                      ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║   NEXT STEPS (5 minutes)                                             ║"
echo "║                                                                      ║"
echo "║   1. START Metabase first (it is deployed in stopped state):           ║"
echo "║      GitHub → Actions → Deploy/Update Metabase → action: start       ║"
echo "║                                                                      ║"
echo "║   2. Then open the Metabase URL above in your browser                ║"
echo "║      (first load takes ~60 seconds — Metabase is initialising)       ║"
echo "║                                                                      ║"
echo "║   2. Complete setup wizard:                                          ║"
echo "║      - Admin email    : your email                                   ║"
echo "║      - Admin password : choose a strong password                     ║"
echo "║                                                                      ║"
echo "║   3. Add your data:                                                  ║"
echo "║      Settings → Databases → Add database                             ║"
echo "║      Type     : PostgreSQL                                           ║"
echo "║      Host     : $PROD_DB_HOST"
echo "║      Port     : 5432                                                 ║"
echo "║      Database : $PROD_DB_NAME"
echo "║      User     : $ANALYTICS_DB_USER (READ-ONLY)"
echo "║      Password : (your ANALYTICS_READER_PASSWORD)                     ║"
echo "║      SSL      : Required                                             ║"
echo "║                                                                      ║"
echo "║   4. Build dashboards:                                               ║"
echo "║      New Question → Native query                                     ║"
echo "║      Paste queries from infra/metabase/dashboard-queries.sql         ║"
echo "║                                                                      ║"
echo "║   NOTE: H2 storage means dashboards are saved inside the container.  ║"
echo "║   Export a backup regularly via:                                     ║"
echo "║   Metabase → Settings → Admin → Troubleshooting → Download logs      ║"
echo "║   Or run the GitHub Action: deploy-metabase → action: backup         ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Config saved to .env.analytics"
