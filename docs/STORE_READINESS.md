# Store readiness and production security

## Mobile app (iOS & Android)

1. **Production API URL** — Edit `src/config/appConfig.ts` and set `PRODUCTION_API_BASE_URL` to your real **HTTPS** backend (including `/api` if your API uses that prefix). Release builds refuse non-HTTPS URLs. Replace this value in CI if you use multiple environments.

2. **Android** — Release builds use `android/app/src/main/res/xml/network_security_config.xml` (no cleartext). **Debug** builds merge `android/app/src/debug/AndroidManifest.xml` so Metro and HTTP dev servers work. Do not ship a release variant that enables cleartext globally.

3. **iOS App Transport Security** — `Info.plist` allows HTTP only for `localhost` / `127.0.0.1` (simulator + Metro). On a **physical device**, plain HTTP to a LAN IP is blocked. Use your **HTTPS** production API, or a TLS tunnel (e.g. ngrok), for device testing against a backend.

## Backend (Azure / Docker)

Set these in Azure App Service configuration or in `.env.prod` for `docker-compose.prod.yml` (see `.env.prod.example`):

- `AllowedHosts` — Your API hostname(s), semicolon-separated; not `*`.
- `Jwt__Key` — At least 32 random characters (use Key Vault in production).
- `PasswordReset__Pepper` — Strong secret (not placeholder text).
- `ConnectionStrings__DefaultConnection` — PostgreSQL with TLS where supported.
- `Cors__AllowedOrigins` — Only HTTPS web origins that need CORS.
- `Email:Smtp:*` — If you use forgot-password email in production.

Never commit real secrets. Rotate anything that was ever exposed in git.

## Store submissions

- **Apple**: Privacy Nutrition Labels, accurate permission strings in `Info.plist`, signing and provisioning.
- **Google Play**: Data safety form, signing key, target API level (see `android/app/build.gradle`).
- **Legal URLs**: Production host must serve **`/privacy`**, **`/support`**, and **`/terms`** (see `docs/STORE-COMPLIANCE.md`); listing URLs should match the app.
