# Azure + Docker deployment (API + mobile checklist)

**You do not share your Azure password or keys with anyone.** Use the Azure Portal, Azure CLI on your machine, and Azure DevOps with **service principals** and **pipeline secret variables**.

This repo includes:

- `backend/Dockerfile` — API container (port **5260** inside the container).
- `docker-compose.yml` — local smoke test (`5260` on host → `5260` in container).
- `azure-pipelines.yml` — build image → Azure Container Registry (ACR) → **Azure App Service (Web App for Containers)**.

The React Native app is **not** run inside Docker; it ships as **iOS** and **Android** binaries to the stores. Docker hosts the **.NET API** only.

---

## 1. Azure resources (once)

Create (names are examples):

| Resource | Purpose |
|----------|---------|
| **Resource group** | e.g. `rg-eliteapp-prod` |
| **Azure Container Registry** | Store `eliteapp-api` images |
| **App Service plan** (Linux) | Host the API |
| **Web App for Containers** | Runs your image from ACR |
| **Azure Database for PostgreSQL** (optional) | Or keep using Supabase / existing Postgres with TLS and firewall rules |
| **Application Insights** (optional) | API telemetry |
| **Key Vault** (recommended) | Secrets; reference from App Service settings |

### App Service container settings (required)

Your API listens on **5260** (`Program.cs`). For Azure’s reverse proxy:

- **Configuration → Application settings** (Web App):

  - `WEBSITES_PORT` = `5260`

- **General settings → Always On** — On (recommended for production).

- **Configuration → Application settings** (examples; use Key Vault references in production):

  - `ConnectionStrings__DefaultConnection` = your Postgres connection string  
  - `Jwt__Key` = strong random secret  
  - `ASPNETCORE_ENVIRONMENT` = `Production`  
  - `AllowedHosts` = your API hostname(s), semicolon-separated (e.g. `your-api.azurewebsites.net`; must not be `*`)

Do **not** commit real connection strings or JWT keys to git. Rotate anything that was ever committed.

---

## 2. Azure DevOps

1. Create a **Project** and connect this repo (GitHub or Azure Repos).
2. **Pipelines → New pipeline** → select the repo → **Existing Azure Pipelines YAML** → `azure-pipelines.yml`.
3. Create a **Variable group** named `EliteApp-Production` (or change the name in `azure-pipelines.yml`) with:

   | Variable | Example / note |
   |----------|----------------|
   | `acrLoginServer` | `myregistry.azurecr.io` |
   | `imageRepository` | `eliteapp-api` |
   | `webAppName` | your Web App name |
   | `dockerRegistryServiceConnection` | name of **Docker Registry** service connection (ACR) |
   | `azureSubscription` | name of **Azure Resource Manager** service connection |

4. Mark sensitive values as **secret** where applicable.
5. Run the pipeline. First run may prompt for **environment** approval if you use the `production` environment with checks.

---

## 3. Local Docker (on your Mac)

**Development** (default `docker-compose.yml`, port **5260** on host):

```bash
cd /path/to/multi-user-auth-app
docker compose build api
docker compose up api
curl -sS http://127.0.0.1:5260/health
```

**Production-like** (same image as Azure; validates `Program.cs` Production rules; port **5260** on host):

```bash
cp .env.prod.example .env.prod
# Edit .env.prod with real secrets (file is gitignored)
docker compose -f docker-compose.prod.yml up --build
curl -sS http://127.0.0.1:5260/health
```

If Docker Desktop is not running, start it first.

---

## 4. Mobile apps (App Store + Google Play)

Docker does **not** build store IPA/AAB for you. Typical approach:

| Platform | What you use |
|----------|----------------|
| **Android** | Android Studio + Gradle release build, or CI (GitHub Actions / Azure DevOps **macOS** agent) signing with a **keystore** stored as a secure pipeline secret. |
| **iOS** | Xcode archive + **App Store Connect**, or CI with **Apple Developer** certificates/profiles in a **secure files** library or Keychain on a macOS agent. |

This repository includes an **`android/`** Gradle project aligned with React Native 0.76.

**Production API URL** in the app: set `PRODUCTION_API_BASE_URL` in **`src/config/appConfig.ts`** to your **HTTPS** App Service URL (including `/api` if your routes use it), e.g. `https://<webapp>.azurewebsites.net/api`. See also `docs/STORE_READINESS.md`.

---

## 5. Bullet-proof checklist

- [ ] Secrets only in Azure (Key Vault / App Service settings / pipeline variables).  
- [ ] `WEBSITES_PORT=5260` on the Web App.  
- [ ] HTTPS only for the API in production; CORS locked down if you expose a web client.  
- [ ] Database firewall allows **Azure** or **App Service outbound IPs** (or use VNet integration).  
- [ ] Pipeline runs on `main`, tags images with `$(Build.BuildId)`, deploys that tag (reproducible rollbacks).  
- [ ] Mobile: versioning, store listings, privacy policy, and platform-specific requirements (e.g. `PrivacyInfo.xcprivacy` on iOS).

---

## 6. If something fails

- **Container exits**: check App Service **Log stream** and that Postgres is reachable from Azure (`ConnectionStrings__DefaultConnection`).  
- **502 / wrong port**: confirm `WEBSITES_PORT=5260`.  
- **Pipeline cannot push to ACR**: fix ACR service connection and RBAC (`AcrPush` on the registry).
