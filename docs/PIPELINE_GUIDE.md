# Azure DevOps Pipeline Guide (Elite App)

This guide provides step-by-step instructions for triggering and managing the deployment pipelines for the Elite Home Services application.

## 🛠️ 1. Required Setup (One-time)

Before running the pipelines, you must configure the following in your Azure DevOps Project (`Pipelines -> Library`).

### A. Variable Group
Create a Variable Group named **`EliteApp-Production`**.
Add the following variables:
- `acrLoginServer`: Your Azure Container Registry URL (e.g., `eliteregprod123.azurecr.io`).
- `imageRepository`: `eliteapp-api`
- `webAppName`: The name of your Azure Web App.
- `ENABLE_MOBILE_ANDROID`: `true` (Set to `false` to skip Android builds).
- `ENABLE_MOBILE_IOS`: `true` (Set to `false` to skip iOS builds).
- `ANDROID_KEYSTORE_PASSWORD`: (Keep marked as a secret 🔐)
- `ANDROID_KEY_ALIAS`: Your keystore alias.
- `ANDROID_KEY_PASSWORD`: (Keep marked as a secret 🔐)
- `IOS_DISTRIBUTION_CERT_PASSWORD`: (Keep marked as a secret 🔐)
- `APPLE_TEAM_ID`: Your Apple Developer Team ID.

### B. Secure Files
Upload your signing assets to `Pipelines -> Library -> Secure files`:
1. `EliteApp.jks` (Android Keystore).
2. `ios_distribution.p12` (iOS Distribution Certificate).
3. `EliteApp_Production.mobileprovision` (iOS Provisioning Profile).

---

## 🚀 2. Triggering the Pipelines

### Backend (Docker & Cloud)
The `azure-pipelines.yml` is the primary pipeline for the backend.
1. Go to **Pipelines** in Azure DevOps.
2. Select the **EliteApp-Backend** pipeline.
3. Click **Run Pipeline**.
4. Select the `main` branch.
5. (Optional) Variables can be overridden if needed.

### Mobile App (iOS & Android Store Builds)
The `azure-pipelines-mobile.yml` generates the binaries for the stores.
1. Select the **EliteApp-Mobile** pipeline.
2. Click **Run Pipeline**.
3. Ensure the branch is `main`.
4. Once completed, the `.aab` (Android) and `.ipa` (iOS) files will be available in the **Artifacts** drop-down of the build summary.

---

## 🛡️ 3. Security & Automation

### CI/CD Automation
The pipelines are configured to trigger **automatically** whenever code is pushed to the `main` or `master` branches.

### Vulnerability Checks
To run a security audit locally before pushing:
```bash
# Frontend
npm audit

# Backend
cd backend
dotnet list package --vulnerable
```

> [!TIP]
> **Pro-Tip**: You can enable "Variable Group" linking in Azure DevOps to pull secrets directly from **Azure Key Vault** instead of typing them into the Library UI. This is the most secure method for production.
