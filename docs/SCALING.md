# Scaling Playbook — Elite Home Services

> Reference guide for growing the infrastructure as user load increases. Start at Section 7 (checklist) before going live with > 100 users.

---

## 1. Current Architecture

Single-region deployment on Azure. All components run as single instances today.

```
  iOS / Android App (React Native 0.76.9)
         |
         | HTTPS
         v
  Azure App Service (Web App for Containers)
  - Single instance (B1 or equivalent)
  - Runs Docker image pulled from ACR
  - Auto-scaling: 1–5 instances (CPU-based, see Section 2)
         |
         | TCP 5432
         v
  Azure Database for PostgreSQL (Flexible Server)
  - Single instance, Burstable tier
  - Daily pg_dump backup → Azure Blob Storage (30-day retention)
         |
  Azure Container Registry (ACR)
  - Stores versioned Docker images (eliteapp-api:<run-number>)
  - Tagged builds; previous tag retained for rollback

  GitHub Actions (CI/CD)
  - backend.yml   → build, test, push to ACR, deploy to App Service
  - ios.yml       → Xcode build + archive
  - android.yml   → Gradle build + sign
  - db-backup.yml → daily pg_dump at 2 AM UTC
  - health-monitor.yml → /health check every 15 min
  - disaster-recovery.yml → on-demand full/partial recovery
```

---

## 2. Auto-Scaling (Already Configured in CI)

Auto-scaling rules are provisioned automatically by `backend.yml` on every deploy to `main`. You do not need to configure this manually.

**Rules applied:**

| Rule | Condition | Action | Cooldown |
|------|-----------|--------|----------|
| Scale out | CPU > 70% (avg over 5 min) | Add 1 instance | 5 min |
| Scale in | CPU < 30% (avg over 10 min) | Remove 1 instance | 10 min |
| Bounds | — | Min: 1 instance, Max: 5 instances | — |

The asymmetric cooldowns (5 min out, 10 min in) are intentional: scale out fast under load, scale in slowly to avoid thrashing.

### Verify auto-scaling is active

```bash
az monitor autoscale list \
  --resource-group $RG \
  --output table
```

Expected output shows `$AZURE_WEBAPP_NAME-autoscale` with `enabled: true`.

To inspect the rules in detail:

```bash
az monitor autoscale show \
  --name $AZURE_WEBAPP_NAME-autoscale \
  --resource-group $RG
```

### Adjust thresholds

If 70%/30% are too aggressive or not aggressive enough for your traffic pattern:

```bash
# Change scale-out threshold to 60% CPU
az monitor autoscale rule update \
  --autoscale-name $AZURE_WEBAPP_NAME-autoscale \
  --resource-group $RG \
  --index 0 \
  --condition "Percentage CPU > 60 avg 5m"

# Change scale-in threshold to 20% CPU
az monitor autoscale rule update \
  --autoscale-name $AZURE_WEBAPP_NAME-autoscale \
  --resource-group $RG \
  --index 1 \
  --condition "Percentage CPU < 20 avg 10m"
```

Or adjust the maximum instance count:

```bash
az monitor autoscale update \
  --name $AZURE_WEBAPP_NAME-autoscale \
  --resource-group $RG \
  --max-count 10
```

> Note: Increasing max instances costs money proportionally. Also read Section 5 first — once you run > 1 instance, you need Redis for shared caching.

---

## 3. Database Scaling

### Current setup

Single Azure Database for PostgreSQL Flexible Server, Burstable tier (1–2 vCores, shared CPU). Good for development and low-traffic production.

### When to upgrade

| Signal | Action |
|--------|--------|
| > 500 concurrent users | Move to General Purpose tier |
| Query times consistently > 200ms | Check for missing indexes first; then consider tier upgrade |
| CPU consistently > 80% on DB server | Upgrade tier |
| Read:write ratio > 5:1 | Add a read replica |

### Upgrade the PostgreSQL tier

Tiers in order of cost and capability: **Burstable → General Purpose → Memory Optimized**

```bash
# Example: upgrade to General Purpose, 4 vCores
az postgres flexible-server update \
  --name $DB_SERVER_NAME \
  --resource-group $RG \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose
```

This causes a brief restart (~1–2 minutes of downtime). Do it during a low-traffic window.

### Add a read replica

Offloads read-heavy queries (job listings, vendor search) from the primary:

```bash
az postgres flexible-server replica create \
  --replica-name $DB_SERVER_NAME-replica \
  --source-server $DB_SERVER_NAME \
  --resource-group $RG \
  --location eastus2
```

After the replica is ready, update `apiClient.ts` or the .NET `DbContext` to route read-only queries to the replica connection string. The replica connection string will be `$DB_SERVER_NAME-replica.postgres.database.azure.com`.

### Connection pooling

At default settings, each App Service instance opens its own connection pool to PostgreSQL. With 5 instances × 20 connections = 100 connections, you will hit the Flexible Server connection limit on Burstable tier (around 50 connections).

**Option A — PgBouncer sidecar** (recommended for > 2 instances):

Add a PgBouncer container alongside the API container. Route all connections through `localhost:5432` → PgBouncer → PostgreSQL. PgBouncer multiplexes thousands of app connections into a small pool against the DB.

**Option B — Azure's built-in PgBouncer** (Flexible Server feature):

```bash
az postgres flexible-server parameter set \
  --server-name $DB_SERVER_NAME \
  --resource-group $RG \
  --name pgbouncer.enabled \
  --value on
```

Connect on port `6432` instead of `5432` to use the built-in pooler. This is the easier path if you do not want to manage a sidecar.

**Connection pool sizing rule of thumb:** `max_connections = max_instances × 20`. Set this in the .NET `appsettings.json` `Npgsql` pool configuration.

---

## 4. CDN for Assets

### The problem

Currently, any user-uploaded photos (job photos, profile pictures) are served through the .NET backend on App Service. Every photo request hits the API container, consuming CPU and bandwidth that should be used for actual API calls. This does not scale.

### The solution

Move photo storage and delivery to Azure Blob Storage + Azure CDN. The API becomes a thin upload coordinator only.

### Steps

**1. Create a Storage Account and container:**

```bash
az storage account create \
  --name eliteappassets \
  --resource-group $RG \
  --location eastus2 \
  --sku Standard_LRS \
  --kind StorageV2

az storage container create \
  --name uploads \
  --account-name eliteappassets \
  --public-access blob
```

**2. Configure CORS on the Storage Account** (required for direct browser/app uploads):

```bash
az storage cors add \
  --account-name eliteappassets \
  --services b \
  --methods GET PUT POST \
  --origins "*" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600
```

In production, replace `"*"` origins with your app's specific domain.

**3. Create an Azure CDN profile and endpoint:**

```bash
az cdn profile create \
  --name eliteapp-cdn \
  --resource-group $RG \
  --sku Standard_Microsoft

az cdn endpoint create \
  --name eliteapp-assets \
  --profile-name eliteapp-cdn \
  --resource-group $RG \
  --origin eliteappassets.blob.core.windows.net \
  --origin-host-header eliteappassets.blob.core.windows.net
```

**4. Update `jobService.ts`** — change the upload endpoint to return a CDN URL:

In `src/services/jobService.ts`, update photo upload calls to:
- POST to `/api/jobs/{id}/upload-url` → backend returns a pre-signed Blob Storage SAS URL.
- Mobile app uploads directly to Blob Storage via the SAS URL (no backend bandwidth used).
- Store the CDN URL (`https://eliteapp-assets.azureedge.net/uploads/<filename>`) in the job record, not the blob URL.

**5. Serve photos from CDN URL** — update any `<Image source={{ uri: job.photoUrl }}>` components to use the CDN URL returned by the API.

### Expected result

80% reduction in backend bandwidth. CDN serves photos from edge nodes geographically close to users with caching, reducing both latency and App Service load.

---

## 5. Redis Caching

### Current state

The .NET backend uses `IMemoryCache` (in-process, in-memory). This works fine with a single App Service instance. When auto-scaling kicks in and you have 2+ instances, each instance has its own independent cache — cache invalidation on instance A does not affect instance B. Users may see stale data depending on which instance they hit.

### When to add Redis

When the autoscaler first scales to 2 instances (i.e., when you see CPU > 70% in production), add Redis before that becomes the steady state.

### Steps

**1. Provision Azure Cache for Redis:**

```bash
az redis create \
  --name eliteapp-redis \
  --resource-group $RG \
  --location eastus2 \
  --sku Basic \
  --vm-size c0
```

Basic C0 is sufficient to start (~250MB, single node). Move to Standard (replicated) when you need high availability.

**2. Add `StackExchange.Redis` to the .NET project:**

```bash
cd backend
dotnet add package StackExchange.Redis
dotnet add package Microsoft.Extensions.Caching.StackExchangeRedis
```

**3. Register distributed cache in `Program.cs`:**

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration["Redis:ConnectionString"];
    options.InstanceName = "eliteapp:";
});
```

**4. Replace `IMemoryCache` with `IDistributedCache`** throughout the codebase. The `IDistributedCache` interface requires explicit serialization — use `System.Text.Json` to serialize objects to byte arrays.

**5. Recommended cache TTLs:**

| Data | TTL | Rationale |
|------|-----|-----------|
| Job list (`GET /api/jobs`) | 30 seconds | Frequently updated; stale data should resolve quickly |
| Vendor list | 5 minutes | Changes infrequently |
| User profile | 10 minutes | Rarely changes; long TTL reduces DB load |
| Auth tokens | Do not cache | Always validate against DB/Key Vault |

**6. Store the Redis connection string as a secret:**

```bash
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "redis-connection-string" \
  --value "$(az redis list-keys --name eliteapp-redis --resource-group $RG --query primaryKey -o tsv)"
```

Add `Redis:ConnectionString` to App Service application settings pointing to the Key Vault reference.

---

## 6. Load Testing Before Launch

Run load tests before going live with real users. Do not skip this — it finds bottlenecks you will not see in dev.

### Tools

- **k6** (recommended) — scriptable, outputs clean metrics, free and open-source.
- **Artillery** — YAML-based config, good for quick tests, also free.

### Targets

| Metric | Target |
|--------|--------|
| Concurrent users | 100 (smoke test), 500 (stress test) |
| p95 response time | < 500ms |
| Error rate | < 0.1% |
| Health endpoint p99 | < 200ms |

### k6 script — basic load test

Save as `loadtest.js` and run with `k6 run loadtest.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // ramp up to 20 users
    { duration: '3m', target: 100 },  // hold at 100 users
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.001'],   // less than 0.1% errors
  },
};

const BASE_URL = 'https://<your-app>.azurewebsites.net';

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
  });

  // Job listing (unauthenticated returns 401, which is expected)
  const jobsRes = http.get(`${BASE_URL}/api/jobs`);
  check(jobsRes, {
    'jobs endpoint responds': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
```

Replace `<your-app>` with `$AZURE_WEBAPP_NAME`. For authenticated endpoint tests, add a JWT token to the `Authorization` header.

### Interpreting results

- If p95 > 500ms at 100 users → check DB query times first, then consider scaling the App Service plan.
- If error rate > 0.1% → check for DB connection pool exhaustion (see Section 3).
- If CPU stays below 30% at 100 users → you have headroom; no immediate action needed.

---

## 7. Scaling Checklist

Run through this before going live with > 100 real users.

- [ ] Auto-scaling rules verified: `az monitor autoscale list --resource-group $RG --output table` shows the autoscale setting as enabled with min=1, max=5
- [ ] App Service plan is at least B2 (2 vCores) or P1V3 — B1 (1 vCore) will saturate quickly under real load
- [ ] DB connection pool max size is set to `max_instances × 20` in .NET Npgsql config (e.g., 5 instances → 100 connections); verify PostgreSQL `max_connections` is set higher than this
- [ ] Redis provisioned and wired if running > 1 App Service instance (prevents cache desync between instances)
- [ ] CDN configured for photo uploads (prevents backend bandwidth saturation from media serving)
- [ ] Load test passed: 100 concurrent users, p95 < 500ms, error rate < 0.1%
- [ ] DB backup verified: `db-backup.yml` has a successful run within the last 24 hours
- [ ] Health monitor active: `health-monitor.yml` is enabled and Slack/webhook alerts are firing to the right channel
- [ ] Rollback tested: confirm a previous ACR image tag exists that you could roll back to manually
