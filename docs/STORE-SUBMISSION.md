# App Store & Google Play — screenshots, assets, and approval checklist

For **policy, privacy strings, ATS, and Play target SDK**, see **`docs/STORE-COMPLIANCE.md`**.

**Important:** Apple and Google require screenshots that **accurately show your running app**. They can reject listings if images are misleading, wrong size, or don’t match the binary. This doc gives **sizes**, **how to capture** from Simulator/emulator, and **what you must complete** for review — it does not replace capturing your own UI.

Official references (bookmark these; sizes change over time):

- Apple: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications), [Upload screenshots](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots)
- Google: [Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)

---

## 1. iOS (App Store Connect)

### Screenshot sizes (typical for new listings)

Apple accepts several device classes; you usually provide **one “primary” set** and App Store Connect can scale for other sizes (verify in your App Store Connect build for the exact prompts).

| Display class (examples) | Portrait (px) | Notes |
|--------------------------|---------------|--------|
| **6.9"** (e.g. Pro Max / Plus class) | **1290 × 2796** or **1320 × 2868** | Often emphasized for newest iPhones |
| **6.5"** | **1284 × 2778** or **1242 × 2688** | Common fallback set |
| **6.3" / 6.1"** | e.g. **1179 × 2556**, **1170 × 2532** | Additional slots if required |

- **Count:** about **3–10** screenshots per localization (Apple allows up to 10; minimum shown in Connect may vary by app type).
- **Format:** PNG or JPEG, typically **≤ 8–10 MB** per file (see Apple’s current limit).
- **Optional:** App Preview videos (MOV, specific codecs — see Apple help).

### How to capture (real app UI)

1. **Xcode** → run on a Simulator whose **window size** matches a row in Apple’s table (e.g. iPhone 16 Pro Max / 15 Pro Max for 6.9" class).  
2. Navigate to **Login**, **Customer home**, **Job detail**, etc.  
3. **Screenshot:** `Device → Screenshot` in Simulator, or Terminal:

   ```bash
   mkdir -p store-assets/ios
   xcrun simctl io booted screenshot "store-assets/ios/01-login.png"
   ```

   Repeat after each screen (rename files: `02-dashboard.png`, …).

4. **Check pixel size** in Preview / Photos; if wrong, pick a different Simulator model in Xcode (**File → Open Simulator** → choose device with required resolution).

### Other iOS assets

| Asset | Purpose |
|--------|---------|
| **App icon** | 1024×1024 (no transparency) in the asset catalog; many sizes generated from it |
| **Privacy Nutrition Labels** | App Store Connect questionnaire (data collection) |
| **`PrivacyInfo.xcprivacy`** | Already in `ios/multiuserauthapp/` — keep accurate |
| **Age rating** | Questionnaire in Connect |
| **Export compliance** | Encryption / `ITSAppUsesNonExemptEncryption` (often “No” for standard HTTPS only — confirm with legal if unsure) |

---

## 2. Android (Google Play Console)

### Required / common assets

| Asset | Size | Notes |
|--------|------|--------|
| **Phone screenshots** | **2–8** images | Often **1080 × 1920** portrait (9:16) or **1920 × 1080** landscape; short edge ≥ **320 px**, long edge ≤ **3840 px**; aspect between **1:2 and 2:1** |
| **Feature graphic** (required) | **Exactly 1024 × 500** | JPEG or 24-bit PNG, no alpha; banner on listing |
| **App icon** | **512 × 512** | Play Console high-res icon |
| **(Optional) Tablet** | e.g. **1080×1920** / **1200×1920** | Improves tablet discovery |

- **Format:** JPEG or 32-bit PNG (follow current Play policy for transparency).

### How to capture

1. Open app in **Android Emulator** (create a device with **1080×1920** or use **Pixel 6** profile).  
2. Navigate through main flows.  
3. Capture:

   ```bash
   mkdir -p store-assets/android
   adb exec-out screencap -p > store-assets/android/01-login.png
   ```

4. **Feature graphic (1024×500):** A starter banner is in **`store-assets/android/feature-graphic-1024x500.png`** (marketing art, not an in-app screenshot). Replace it with your own branding if you prefer.

---

## 3. What you need beyond screenshots (approval-oriented)

### Both stores

- **Developer accounts:** [Apple Developer Program](https://developer.apple.com/programs/) (annual fee), [Google Play Console](https://play.google.com/console/) (one-time registration fee).
- **Privacy policy URL** (public HTTPS) — required if you collect personal data, logins, etc. (this project: `…/privacy` on your API site root).
- **Terms of service URL** — recommended; this project serves **`…/terms`** from the same host.
- **Support URL or email** (Apple often wants a contact; Play wants support). This project: **`…/support`**.
- **Accurate description** — no misleading claims; match actual features (jobs, chat, roles, etc.).
- **Demo account** for reviewers if login is required (Apple: App Review Information; Play: similar in testing instructions).
- **Content rights** — fonts, images, logos, third-party APIs licensed.

### Apple-specific

- **App Privacy** details (data types, tracking, linked to user).
- **Sign in with Apple** — only if you offer other third-party logins (you may not trigger this if email/password only).
- **Guideline 2.1** — app completeness, no broken flows.
- **TestFlight** optional but useful for internal QA before submit.

### Google-specific

- **Data safety form** (data collection, sharing, security).
- **Target API level** — must meet Play’s current target SDK requirement (upgrade `compileSdk` / `targetSdk` as policy updates).
- **Content rating** questionnaire (IARC).
- **(If applicable)** Permissions declarations (photos, notifications, etc.).

### Backend / legal (your Azure API)

- **Production HTTPS** endpoint; mobile `PROD_URL` in `src/services/apiClient.ts` must match.
- **Terms of service** / privacy if you handle PII or payments later.

---

## 4. Suggested screenshot storyboard (your app)

Capture **5–8** flows that show real value (same flows on iOS and Android for consistency):

1. Login / role selection  
2. Customer dashboard (jobs list)  
3. Job detail  
4. Vendor or admin view (if applicable)  
5. Chat or messaging (if in scope)  
6. Profile or signup (optional)

Use **realistic test data** (no offensive content).

---

## 5. Repo folder suggestion

```text
store-assets/
  ios/          # PNGs at Apple-required resolution
  android/      # PNGs + separate 1024×500 feature graphic source
```

Add `store-assets/` to `.gitignore` if screenshots contain private data; otherwise commit only if your team is OK with it.

---

## Summary

| You must supply | Automated / fake “screenshots” |
|-----------------|--------------------------------|
| Real captures from Simulator + Emulator (or device) | Not acceptable as a substitute for your UI in review |
| Feature graphic 1024×500 (Android) | Design file; not a lie about app content |
| All Connect / Play forms, privacy, demo account | No tool can do this without your business details |

### Helper script

From the repo root (Simulator and/or Android emulator running):

```bash
./scripts/capture-store-screenshots.sh
```

Saves under `store-assets/ios/` and `store-assets/android/`. Rename files and repeat after navigating to each screen you want in the listing.
