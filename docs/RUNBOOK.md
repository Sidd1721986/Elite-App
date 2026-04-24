# Production Incident Runbook — Elite Home Services

> Written for developers who need to act fast. Keep this tab open during incidents.

---

## 1. Severity Levels

| Level | Name | Definition | Example | Target Response |
|-------|------|------------|---------|-----------------|
| **P0** | Total Outage | Service completely unreachable for all users | API returns 5xx, app cannot connect at all | Immediate — wake someone up |
| **P1** | Major Feature Broken | Core workflow down but service partially available | Login fails for all users, job creation 500s | < 30 minutes |
| **P2** | Degraded Performance | Feature works but slowly or intermittently | API p95 > 3s, occasional 502s, photo uploads failing | < 2 hours |
| **P3** | Minor Issue | Low-impact problem affecting a small subset of users | One edge-case UI bug, non-critical endpoint slow | Next business day |

---

## 2. First Response (< 5 minutes)

Run these checks in order. Stop at the first thing that looks wrong.

### Step 1 — Check the health endpoint

```bash
curl -sv https://$AZURE_WEBAPP_NAME.azurewebsites.net/health
```

- `HTTP 200` → backend is up; the problem is likely mobile-side or a specific API endpoint.
- `HTTP 5xx` or connection refused → backend is down; go to Step 3.
- Timeout → App Service may be restarting or the plan is out of resources.

The health-monitor workflow also runs every 15 minutes and posts to Slack on failure — check your Slack channel first before doing manual checks.

### Step 2 — Check GitHub Actions for recent failed deploys

Open the repo `/actions` tab. Look for:
- A red `backend.yml` run in the last 30 minutes → a bad deploy likely caused this.
- A red `db-backup.yml` run → backup job failed (does not affect live traffic but warrants investigation).
- A failed rollback step inside backend.yml → automatic rollback ran but may not have completed successfully.

### Step 3 — Tail live App Service logs

```bash
az webapp log tail \
  --name $APP_NAME \
  --resource-group $RG
```

Look for:
- `System.Data.SqlClient` or `Npgsql` exceptions → database connection problem.
- `OutOfMemoryException` → instance is under-provisioned or has a memory leak.
- Unhandled 500 stack traces → code-level bug.

### Step 4 — Check db-backup.yml last run

In GitHub Actions, confirm `Database Backup` last ran successfully at 2 AM UTC. If the backup is more than 25 hours old, treat it as a P1 side-issue alongside any active incident — you may not have a clean restore point.

---

## 3. Bug in Production — Fix Process

### JS-only bug (no native code changes)

This is the fastest possible fix — no App Store review required.

1. Create a `hotfix/js-<description>` branch off `main`.
2. Make the fix and push.
3. In GitHub Actions, trigger a **workflow dispatch** on `mobile-ota` workflow targeting the hotfix branch.
4. The OTA update is delivered to active users within minutes via the JS bundle update mechanism.
5. Verify the fix by force-closing and reopening the app on a test device.

> Note: OTA only covers JS/TypeScript changes. If you touched any native module, Objective-C/Swift, Java/Kotlin, or `package.json` native dependencies, you need a full store build (see below).

### Backend bug

1. Create a `hotfix/backend-<description>` branch off `main`.
2. Make the fix, push, and open a PR.
3. After merge, trigger a **workflow dispatch** on `backend.yml` — it builds, pushes to ACR, and deploys to Azure App Service in approximately 5 minutes.
4. Watch the post-deploy health check in the workflow logs. If it fails, automatic rollback is triggered.
5. Verify by hitting the affected endpoint directly.

### Native mobile bug (requires App Store / Play Store update)

This path takes the longest — plan accordingly.

1. Create a `hotfix/native-<description>` branch off `main`.
2. Bump the version and build number in `ios/` and `android/` configs.
3. Make the fix and open a PR. Merge to `main`.
4. The `ios.yml` and `android.yml` CI workflows trigger automatically on merge.
5. Download the artifacts once builds pass.
6. Submit to App Store Connect and Google Play Console.
7. For Apple: contact App Store Review through App Store Connect and request **expedited review**. Apple typically reviews hotfixes in under 24 hours when a critical bug is documented in the request.
8. For Google: expedited review is not formally offered — expect 2–4 hours under standard review.

### Database / data bug

Use `disaster-recovery.yml` for point-in-time restoration:

1. Go to GitHub Actions → `Disaster Recovery` → `Run workflow`.
2. Set `recovery_mode` to `db-restore`.
3. Optionally specify a `backup_file` (e.g., `eliteapp_backup_20260421_020000.sql.gz`). Leave blank to use the latest backup (2 AM UTC daily).
4. Type `CONFIRM` in the confirmation field.
5. The workflow downloads the backup from Azure Blob Storage, drops the current database, and restores from the dump.
6. After restore completes, run migrations manually if the bug was migration-related.

> Warning: `db-restore` will overwrite the live database. Any data written after the backup timestamp will be lost. Communicate to users before triggering.

---

## 4. Rollback Procedures

### Backend rollback

**Automatic (preferred):** The `backend.yml` deploy workflow runs a post-deploy health check and smoke tests against `/health` and `/api/jobs`. If either fails, the pipeline automatically re-deploys the previous image tag captured before the deploy started. Watch the `Rollback on health check or smoke test failure` step in the workflow run.

**Manual rollback** (when you need to roll back outside of a pipeline run):

```bash
# Find the previous run number (image tag) from ACR
az acr repository show-tags \
  --name $ACR_NAME \
  --repository eliteapp-api \
  --orderby time_desc \
  --output table

# Roll back to a specific tag
az webapp config container set \
  --name $AZURE_WEBAPP_NAME \
  --resource-group $RG \
  --docker-custom-image-name $ACR_LOGIN_SERVER/eliteapp-api:<previous-tag>

# Verify the app came back up
curl -sv https://$AZURE_WEBAPP_NAME.azurewebsites.net/health
```

### Mobile rollback

**You cannot roll back a released mobile app version.** Once a version is live on the App Store or Play Store, users on that version stay on it until they update.

Options:
- **JS-only fix:** Push an OTA update immediately (see Section 3). This is the de facto rollback for JS bugs.
- **Native bug:** Submit a new version with the fix. Expedite review (Apple) or rely on fast automated review (Google).
- **Feature flag:** If the app includes feature flags, disable the broken feature server-side via the API to reduce blast radius while the fix is prepared.

---

## 5. Common Issues & Fixes

| Symptom | First Check | Fix |
|---------|-------------|-----|
| API returns 500 on all endpoints | `az webapp log tail` for stack trace | Check DB connection string in App Service env vars; verify PostgreSQL server is running; check that EF Core migrations ran |
| App won't load / blank screen on launch | Check `PROD_API_URL` secret in GitHub; curl the health endpoint | Verify `PROD_API_URL` secret resolves to the correct Azure hostname; check CORS settings in backend `appsettings.json` allow the app's origin |
| Login fails for all users | Check JWT config in logs | Verify `JWT_KEY` secret is set in Azure Key Vault and accessible to the App Service; confirm `appsettings.json` JWT issuer/audience match what the mobile app sends; check that DB migrations ran and the `users` table exists |
| Login fails for one user | Check that user record exists | User may have been created with a different auth method; check DB directly |
| Push notifications not working | N/A | Not implemented yet — placeholder for future FCM/APNS integration |
| Slow API responses (> 1s) | Azure Portal → App Service → Metrics → CPU/Memory | Check App Service instance count (auto-scaling may not have triggered yet); run `EXPLAIN ANALYZE` on suspect queries in PostgreSQL; check if a DB index is missing |
| 502 Bad Gateway | App Service plan throttling | Scale up manually: `az appservice plan update --sku P2V3` or increase instance count |
| DB backup job failing | Check `db-backup.yml` run logs | Verify `BACKUP_STORAGE_ACCOUNT`, `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` secrets are set; check storage account firewall allows GitHub Actions egress IPs |
| Health monitor Slack alert firing but app seems OK | Race condition / cold start | If health recovers within 1–2 minutes, likely a cold start after scale-in. Consider raising minimum instance count to 2 to prevent cold starts in production |

---

## 6. Key Contacts & Links

| Resource | Link / Value |
|----------|--------------|
| Azure Portal | https://portal.azure.com |
| GitHub Actions | `https://github.com/<org>/multi-user-auth-app/actions` |
| Azure Container Registry | Azure Portal → Resource Groups → EliteApp-production-RG → ACR |
| App Service | Azure Portal → `$AZURE_WEBAPP_NAME` |
| PostgreSQL Flexible Server | Azure Portal → EliteApp-production-RG → PostgreSQL server |
| DB Backups (Blob Storage) | Azure Portal → `$BACKUP_STORAGE_ACCOUNT` → Containers → db-backups |
| Slack alert webhook | Configured as `ALERT_WEBHOOK_URL` secret in GitHub; also `SLACK_WEBHOOK_URL` for deploy failures |
| Disaster Recovery workflow | `.github/workflows/disaster-recovery.yml` |
| Health Monitor workflow | `.github/workflows/health-monitor.yml` (runs every 15 min) |
| DB Backup workflow | `.github/workflows/db-backup.yml` (runs daily at 2 AM UTC) |

> Replace `<org>` with the actual GitHub organization or username before sharing this document.
