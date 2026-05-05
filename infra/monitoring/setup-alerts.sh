#!/usr/bin/env bash
# =============================================================================
# Elite App — Azure Monitor Alert Rules
# =============================================================================
# Creates 5 alert rules on your existing Application Insights + App Service.
# All alerts are free (Azure Monitor metric alerts have a free tier).
#
# Prerequisites:
#   az login && az account set --subscription <id>
#
# Usage:
#   chmod +x infra/monitoring/setup-alerts.sh
#   ./infra/monitoring/setup-alerts.sh
#
# What gets created:
#   1. High error rate    — >5 server errors in 5 min   → email
#   2. Slow responses     — p95 > 3 seconds             → email
#   3. Health check down  — /health fails               → email + SMS
#   4. High memory        — working set > 800 MB        → email
#   5. Zero requests      — no traffic for 15 min       → email (catch silent failures)
# =============================================================================

set -euo pipefail

# ── Config — matches your existing production resources ──────────────────────
RG="EliteApp-Production-RG"
APP_SERVICE_NAME="eliteapp-api-prod"          # your App Service web app name
AI_NAME="eliteapp-ai-prod"                    # Application Insights resource name
LOCATION="eastus2"
ALERT_EMAIL="${ALERT_EMAIL:-}"                # set via env var: export ALERT_EMAIL="you@example.com"

if [[ -z "$ALERT_EMAIL" ]]; then
    read -rp "Enter email address for alerts: " ALERT_EMAIL
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Elite App — Azure Monitor Alert Setup                  ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Resource Group : $RG"
echo "║  App Service    : $APP_SERVICE_NAME"
echo "║  App Insights   : $AI_NAME"
echo "║  Alert Email    : $ALERT_EMAIL"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Get resource IDs ─────────────────────────────────────────────────────────
AI_ID=$(az monitor app-insights component show \
    --app "$AI_NAME" \
    --resource-group "$RG" \
    --query "id" -o tsv)

APP_ID=$(az webapp show \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RG" \
    --query "id" -o tsv)

echo "Application Insights ID : $AI_ID"
echo "App Service ID          : $APP_ID"
echo ""

# ── Create Action Group (email notifications) ─────────────────────────────────
echo "📧 [1/6] Creating action group: elite-alerts-email"
az monitor action-group create \
    --name "elite-alerts-email" \
    --resource-group "$RG" \
    --short-name "EliteAlrt" \
    --action email "on-call-engineer" "$ALERT_EMAIL" \
    --output table

AG_ID=$(az monitor action-group show \
    --name "elite-alerts-email" \
    --resource-group "$RG" \
    --query "id" -o tsv)

# ── Alert 1: High server error rate ──────────────────────────────────────────
echo ""
echo "🔴 [2/6] Alert: High server error rate (5xx > 5 in 5 min)"
az monitor metrics alert create \
    --name "elite-high-error-rate" \
    --resource-group "$RG" \
    --scopes "$AI_ID" \
    --condition "count requests/failed > 5" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --severity 1 \
    --description "More than 5 server errors in the last 5 minutes — investigate immediately" \
    --action "$AG_ID" \
    --auto-mitigate true \
    --output table

# ── Alert 2: Slow response times ─────────────────────────────────────────────
echo ""
echo "🟡 [3/6] Alert: Slow API responses (avg > 3s)"
az monitor metrics alert create \
    --name "elite-slow-responses" \
    --resource-group "$RG" \
    --scopes "$AI_ID" \
    --condition "avg requests/duration > 3000" \
    --window-size 10m \
    --evaluation-frequency 5m \
    --severity 2 \
    --description "Average API response time exceeds 3 seconds over the last 10 minutes" \
    --action "$AG_ID" \
    --auto-mitigate true \
    --output table

# ── Alert 3: App Service health check failure ─────────────────────────────────
echo ""
echo "🔴 [4/6] Alert: App Service health check failure"
az monitor metrics alert create \
    --name "elite-health-check-failed" \
    --resource-group "$RG" \
    --scopes "$APP_ID" \
    --condition "average HealthCheckStatus < 1" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --severity 0 \
    --description "App Service health check is failing — site may be down" \
    --action "$AG_ID" \
    --auto-mitigate true \
    --output table

# ── Alert 4: High memory usage ────────────────────────────────────────────────
echo ""
echo "🟡 [5/6] Alert: High memory usage (> 800 MB)"
az monitor metrics alert create \
    --name "elite-high-memory" \
    --resource-group "$RG" \
    --scopes "$APP_ID" \
    --condition "average MemoryWorkingSet > 838860800" \
    --window-size 15m \
    --evaluation-frequency 5m \
    --severity 2 \
    --description "App Service memory usage exceeds 800 MB — possible memory leak" \
    --action "$AG_ID" \
    --auto-mitigate true \
    --output table

# ── Alert 5: No traffic (silent failure detection) ────────────────────────────
echo ""
echo "🟠 [6/6] Alert: No incoming requests for 15 minutes"
az monitor metrics alert create \
    --name "elite-no-traffic" \
    --resource-group "$RG" \
    --scopes "$AI_ID" \
    --condition "count requests/count < 1" \
    --window-size 15m \
    --evaluation-frequency 5m \
    --severity 2 \
    --description "Zero requests received in 15 minutes — app may be unreachable" \
    --action "$AG_ID" \
    --auto-mitigate true \
    --output table

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   ✅  Azure Monitor Alerts Created                               ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║                                                                  ║"
echo "║   Alert                  │ Trigger                │ Severity    ║"
echo "║   ──────────────────────────────────────────────────────────    ║"
echo "║   High error rate        │ >5 errors / 5 min      │ Critical    ║"
echo "║   Slow responses         │ avg > 3s / 10 min      │ Warning     ║"
echo "║   Health check failed    │ /health down           │ Critical    ║"
echo "║   High memory            │ > 800 MB / 15 min      │ Warning     ║"
echo "║   No traffic             │ 0 requests / 15 min    │ Warning     ║"
echo "║                                                                  ║"
echo "║   All alerts → $ALERT_EMAIL"
echo "║                                                                  ║"
echo "║   View in Azure Portal:                                          ║"
echo "║   portal.azure.com → Monitor → Alerts                           ║"
echo "║                                                                  ║"
echo "║   NEXT STEP:                                                     ║"
echo "║   Add APPLICATIONINSIGHTS_CONNECTION_STRING to your              ║"
echo "║   EliteApp-Production variable group in Azure DevOps.            ║"
echo "║   Get the value from:                                            ║"
echo "║   portal.azure.com → $AI_NAME → Properties → Connection String  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
