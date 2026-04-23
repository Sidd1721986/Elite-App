# 📱 Mobile Release Guide: Elite Home Services

This guide provides the step-by-step instructions to build, sign, and deploy your mobile application to the **Apple App Store** and **Google Play Store**.

---

## 📋 Prerequisites
Before you begin, ensure you have:
1. **Apple Developer Account**: [developer.apple.com](https://developer.apple.com/) (Choose **Organization** during enrollment).
2. **Google Play Console Account**: [play.google.com/console](https://play.google.com/console) (Choose **Organization**).
3. **D-U-N-S Number**: Required for both (which you already have).

---

## 🏢 Organization (Company) Requirements
Since you are enrolling as a company, you need the following additional items:

### 1. Legal Entity Status
Your company must be a legal entity (e.g., Corp, LLC, Ltd) so that it can be bound by the terms and conditions.

### 2. D-U-N-S® Number
Ensure the **Legal Name** and **Address** in your Apple/Google records match your D-U-N-S record exactly.

### 3. Legal Binding Authority
You must have the legal authority to bind the organization to legal agreements.

---

## 🤖 Part 1: Android Deployment (Google Play)

### 1. Create the App Record
1. Go to the [Google Play Console](https://play.google.com/console).
2. Click **Create app** and ensure it matches `com.eliteservices.app`.

### 2. Generate Your Production Keystore
Run this command in your terminal to create the file that "locks" your Android app for production.

```bash
keytool -genkey -v -keystore elite-production.jks -alias elite-app -keyalg RSA -keysize 2048 -validity 10000
```
- **Keystore file**: `elite-production.jks` will be created.
- **Alias**: `elite-app`.

### 3. Configure Azure DevOps
1. Upload `elite-production.jks` to **Pipelines -> Library -> Secure files**.
2. Go to **Variable groups -> EliteApp-Production** and add the keystore passwords and alias.

3. **Gradle:** Release builds (`assembleRelease`, `bundleRelease`) require `android/keystore.properties` (see `android/keystore.properties.example`). For a **local** unsigned experiment only, you may pass `-PallowInsecureReleaseSigning=true` — **never** upload those artifacts to Google Play.

---

## 🍎 Part 2: iOS Deployment (App Store)

### 1. Create the App Record
1. Go to [App Store Connect](https://appstoreconnect.apple.com/).
2. Create a New App for Bundle ID `com.eliteservices.app`.

### 2. Generate Signing Credentials
1. **Certificate**: Create an **Apple Distribution** certificate in the Apple Portal.
2. **Export .p12**: Export the certificate from your Keychain with a password.
3. **Provisioning Profile**: Create an **App Store** profile for your Bundle ID.

### 3. Configure Azure DevOps
1. Upload your `.p12` and `.mobileprovision` to **Secure files**.
2. Add the team ID and profile passwords to the **EliteApp-Production** variable group.

---

## 🚀 Part 3: Triggering the Build & Submission

### 📤 Screenshots (Literal Product Photos)
1. Run the app on your real phone or an official emulator.
2. Take screenshots of the main screens (Login, Booking, Profile).
3. Place them in the `store_submission/` asset folders.
   - **iOS 6.5"**: iPhone 15 Pro Max size.
   - **iOS 5.5"**: iPhone 8 Plus size.

### 📦 Building
1. Push your code to `main`.
2. Download the resulting `.aab` (Android) or `.ipa` (iOS) from the pipeline artifacts.
3. Upload to the stores and submit for review.

---

> [!TIP]
> **Legal Requirements**:
> For both stores, use these URLs for the metadata:
> - **Privacy Policy**: `https://eliteapp-api-prod.azurewebsites.net/api/legal/privacy`
> - **Support URL**: `https://eliteapp-api-prod.azurewebsites.net/api/legal/support`
