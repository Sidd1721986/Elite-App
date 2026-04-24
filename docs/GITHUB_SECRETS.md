# GitHub Secrets — Setup Reference

Add these in: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

---

## ✅ Already Needed Now (Android signing — set these before your first build)

| Secret | How to get it |
|--------|---------------|
| `ANDROID_KEYSTORE_BASE64` | Run: `base64 -i release.keystore` — paste the output |
| `ANDROID_KEYSTORE_PASSWORD` | The password you chose when generating the keystore |
| `ANDROID_KEY_ALIAS` | The alias you chose (e.g. `elite-key`) |
| `ANDROID_KEY_PASSWORD` | The key password (usually same as store password) |

**Generate your keystore (one-time, save it somewhere safe):**
```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias elite-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```
> ⚠️ Never commit `release.keystore` to git. Store a backup somewhere safe — if you lose it you cannot update your app on Play Store.

---

## ✅ Already Needed Now (iOS signing — set before your first build)

| Secret | How to get it |
|--------|---------------|
| `IOS_DISTRIBUTION_CERT_BASE64` | Export your Distribution cert from Keychain as `.p12`, then: `base64 -i cert.p12` |
| `IOS_DISTRIBUTION_CERT_PASSWORD` | The password you set when exporting the `.p12` |
| `IOS_PROVISION_PROFILE_BASE64` | Download the provisioning profile from developer.apple.com, then: `base64 -i profile.mobileprovision` |
| `IOS_PROVISIONING_PROFILE_SPECIFIER` | The profile name exactly as it appears in Xcode (e.g. `Elite Home Services Distribution`) |
| `APPLE_TEAM_ID` | 10-character ID — find it at developer.apple.com under Membership |

> These require an **Apple Developer account ($99/year)**. Sign up at [developer.apple.com](https://developer.apple.com).

---

## 🔜 Add When You Get Your Apple Developer Account (TestFlight auto-upload)

| Secret | How to get it |
|--------|---------------|
| `APPLE_API_KEY_ID` | App Store Connect → Users & Access → Keys → Create a key with "Developer" role → copy the Key ID |
| `APPLE_API_ISSUER_ID` | Same page — the Issuer ID shown at the top |
| `APPLE_API_PRIVATE_KEY` | Download the `.p8` file from that page — paste its full contents (including `-----BEGIN PRIVATE KEY-----`) |

> Once these 3 secrets are set, every push to `main` will automatically upload to TestFlight.  
> ⚠️ The `.p8` file can only be downloaded once — save it securely.

---

## 🔜 Add When You Get Your Google Play Console Account (Play Store auto-upload)

| Secret | How to get it |
|--------|---------------|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play Console → Setup → API access → Create service account → Grant "Release Manager" role → Create JSON key → paste file contents |

> Once this secret is set, every push to `main` will auto-upload an AAB to the **Internal Testing** track (as a draft — you promote it to production manually from Play Console).  
> Step-by-step: [Play Console service account guide](https://developers.google.com/android-publisher/getting_started)

---

## 🔜 Add When Backend Goes to Production

| Secret | How to get it |
|--------|---------------|
| `PROD_API_URL` | The HTTPS URL of your production backend (e.g. `https://api.elitehomeservices.com`) |

> Until this is set, CI uses whatever URL is in `src/config/env.ts`. Set this before submitting to either store.

---

## Summary Checklist

| When | Secrets to add |
|------|---------------|
| Before first CI build (Android) | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| Before first CI build (iOS) | `IOS_DISTRIBUTION_CERT_BASE64`, `IOS_DISTRIBUTION_CERT_PASSWORD`, `IOS_PROVISION_PROFILE_BASE64`, `IOS_PROVISIONING_PROFILE_SPECIFIER`, `APPLE_TEAM_ID` |
| When Apple Developer account ready | `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_PRIVATE_KEY` |
| When Google Play Console account ready | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| When backend in production | `PROD_API_URL` |
