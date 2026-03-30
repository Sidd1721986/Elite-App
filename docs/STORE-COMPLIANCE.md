# iOS App Store & Google Play — compliance norms (this project)

Use this with **`docs/STORE-SUBMISSION.md`** (sizes + capture). **Phone/tablet store screenshots must come from your real app** (Simulator / emulator / device). Fabricated marketing “screens” that don’t match the binary are a common rejection reason.

---

## Apple App Store

### Review baseline
- **[App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)** — safety, performance, business, design, legal.
- **2.1 App completeness** — no broken flows, placeholders, or “test” banners in production.
- **2.3 Accurate metadata** — description, screenshots, and previews must reflect the app.
- **5.1 Privacy** — [Privacy details](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy) in App Store Connect must match behavior (login, email, photos, etc.).

### This repo (iOS) — what we aligned
| Item | Status / action |
|------|------------------|
| **Photo library / camera** | `CustomerDashboard` uses `react-native-image-picker` → **`NSPhotoLibraryUsageDescription`**, **`NSCameraUsageDescription`**, **`NSPhotoLibraryAddUsageDescription`** added to `Info.plist` (required when those APIs are used). |
| **Privacy manifest** | `PrivacyInfo.xcprivacy` present — keep API reasons accurate when you upgrade RN / pods. |
| **App Tracking Transparency** | `NSPrivacyTracking` is false — if you add ads/analytics that track across apps, you’ll need ATT and updated declarations. |
| **ATS (`NSAppTransportSecurity`)** | **`NSAllowsArbitraryLoads` = true`** helps **local dev** (HTTP). For **store review**, Apple may question it. **Before release:** prefer **HTTPS-only** API and narrow ATS to your API host (exception domain) or remove arbitrary loads for Release builds. |
| **Encryption / export** | Answer the **export compliance** questions in App Store Connect; standard HTTPS alone is often exempt — confirm for your jurisdiction. |

### You still must provide
- Privacy policy URL, support URL/email, accurate **App Privacy** labels.
- **Demo account** for reviewers if login is required.
- Screenshots / previews from **real builds** on supported device sizes.

---

## Google Play

### Policy baseline
- **[Developer Policy Center](https://play.google.com/about/developer-content-policy/)**
- **[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)** — must match app behavior (account, photos, etc.).
- **Target API level** — must meet Play’s **target SDK** requirement for new apps/updates (raise `targetSdkVersion` in Gradle as policy updates).

### This repo (Android)
- There is **no `android/` project** in tree yet. When you add it (React Native template / `react-native init` alignment):
  - Add **`READ_MEDIA_IMAGES`** / **`READ_EXTERNAL_STORAGE`** (as required by API level) if you use the image picker on older APIs; follow [photo picker](https://developer.android.com/training/data-storage/shared/photopicker) guidance for modern Android.
  - Declare **permissions only** for features you use; justify each in Play Console.
  - **Feature graphic** `1024 × 500` — use the asset in `store-assets/android/` (see below) or replace with your own branding.

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

- [ ] Production API is **HTTPS**; app `PROD_URL` points to it.
- [ ] No debug-only URLs or “localhost” in **release** builds.
- [ ] Privacy policy + support contact live.
- [ ] Reviewer demo account documented.
- [ ] ATS / cleartext traffic policy reviewed for **iOS Release**.
- [ ] Android **targetSdk** meets Play requirement when `android/` exists.
- [ ] Screenshot set captured from **release** or **release-candidate** builds.

---

## Scripts

```bash
./scripts/capture-store-screenshots.sh
```

See **`docs/STORE-SUBMISSION.md`** for exact pixel sizes and official links.
