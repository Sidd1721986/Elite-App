# iOS App Store & Google Play — compliance norms (this project)

Use this with **`docs/STORE-SUBMISSION.md`** (sizes + capture). **Phone/tablet store screenshots must come from your real app** (Simulator / emulator / device). Fabricated marketing “screens” that don’t match the binary are a common rejection reason.

---

## Hosted legal URLs (single source of truth)

The backend serves HTML at the **site root** (strip `/api` from your API base URL for listings):

| URL path | Purpose |
|----------|---------|
| `/privacy` | Privacy policy — use this exact URL in **App Store Connect** and **Google Play** |
| `/support` | Support + safety reporting |
| `/terms` | Terms of service |

The mobile app opens these URLs from **Privacy Policy**, **Terms**, **Contact Support**, and **Chat → Safety & reporting** so in-app behavior matches store listings.

---

## App Store Connect “App Privacy” & Play “Data safety” (mirror this)

Declare data types consistent with the app and backend. Use the table below when filling the questionnaires.

| Data / practice | Typical disclosure | Notes |
|-----------------|-------------------|--------|
| **Name, email, phone, address** | Collected, linked to identity, used for app functionality / account management | Account signup and profiles |
| **User-generated content (messages, job text)** | Collected, linked, app functionality | In-app chat and job flows |
| **Photos / videos** | Collected (optional), linked, app functionality | Image picker + uploads |
| **Account deletion** | Users can **deactivate** in **Account details** (soft delete); say retention where legally required | Align wording with hosted privacy policy |
| **Tracking** | Not used for cross-app tracking today | `NSPrivacyTracking` is false; update if you add ads/analytics SDKs that track |

If you add third-party SDKs (crash reporting, analytics, ads), re-run this table and update **`PrivacyInfo.xcprivacy`** and both store forms.

---

## Apple App Store

### Review baseline
- **[App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)** — safety, performance, business, design, legal.
- **2.1 App completeness** — no broken flows, placeholders, or “test” banners in production.
- **2.3 Accurate metadata** — description, screenshots, and previews must reflect the app.
- **5.1 Privacy** — [Privacy details](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy) in App Store Connect must match behavior (login, email, photos, messages, etc.).

### This repo (iOS) — what we aligned
| Item | Status / action |
|------|------------------|
| **Photo library / camera** | Image picker / chat attachments → **`NSPhotoLibraryUsageDescription`**, **`NSCameraUsageDescription`**, **`NSPhotoLibraryAddUsageDescription`** in `Info.plist`. |
| **Privacy manifest** | `PrivacyInfo.xcprivacy` includes required-reason APIs and **collected data types** aligned with account + jobs + chat + photos. Update when you change features or upgrade RN/pods. |
| **App Tracking Transparency** | `NSPrivacyTracking` is false — if you add ads/analytics that track across apps, you’ll need ATT and updated declarations. |
| **ATS (`NSAppTransportSecurity`)** | **`NSAllowsLocalNetworking`** only — production API must be **HTTPS** (see `docs/STORE_READINESS.md`). |
| **Encryption / export** | `ITSAppUsesNonExemptEncryption` is false; still complete **export compliance** questions in App Store Connect. |

### You still must provide
- Privacy policy URL, support URL/email, accurate **App Privacy** labels (use table above).
- **Demo account** for reviewers if login is required.
- Screenshots / previews from **real builds** on supported device sizes.

---

## Google Play

### Policy baseline
- **[Developer Policy Center](https://play.google.com/about/developer-content-policy/)**
- **[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)** — must match app behavior (account, photos, messages, etc.).
- **Target API level** — `targetSdkVersion` / `compileSdk` in `android/build.gradle` (currently **35**); revisit when Google raises requirements.

### This repo (Android)
- Native project under **`android/`**: `INTERNET`, `CAMERA`, **`READ_MEDIA_IMAGES`**, **`READ_EXTERNAL_STORAGE`** (max SDK 32) for image features; no broad `WRITE_EXTERNAL_STORAGE` in the main manifest.
- **Release signing:** `bundleRelease` / `assembleRelease` **require** `android/keystore.properties` unless you pass **`-PallowInsecureReleaseSigning=true`** (local experiments only — **never** upload those builds to Play). See `android/keystore.properties.example` and **`docs/MOBILE_RELEASE_GUIDE.md`**.
- Declare and justify permissions in Play Console; match **Data safety** to the table above.

### You still must provide
- Data safety form, content rating, store listing text, **512×512** icon, **feature graphic**, **phone screenshots** (real app).

---

## Screenshots — what we can and cannot “create”

| Asset | Automated in repo? | Store compliance |
|--------|-------------------|------------------|
| **Google Play feature graphic (1024×500)** | Yes — designed banner in `store-assets/android/` | Allowed as **marketing** art (not a fake in-app screenshot). |
| **iPhone / Android phone screenshots** | **No** — use Simulator/emulator + `./scripts/capture-store-screenshots.sh` | Must show **actual UI** of the submitted build. |

---

## Pre-submit checklist (both stores)

- [ ] Production API is **HTTPS**; `src/config/env.ts` `PRODUCTION_API_BASE_URL` points to it.
- [ ] No debug-only URLs or “localhost” in **release** builds.
- [ ] `/privacy`, `/support`, and `/terms` return **200** on production host; same URLs in both consoles.
- [ ] Reviewer demo account documented.
- [ ] **App Privacy** + **Data safety** completed using the disclosure table above.
- [ ] Android **targetSdk** meets Play requirement (`android/build.gradle`).
- [ ] Screenshot set captured from **release** or **release-candidate** builds.

---

## Scripts

```bash
./scripts/capture-store-screenshots.sh
```

See **`docs/STORE-SUBMISSION.md`** for exact pixel sizes and official links.
