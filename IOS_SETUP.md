# iOS Setup (Elite App)

Use **Node.js 20.x** in this repo (`.nvmrc` + `package.json` `engines`).

## Clean build (fix white screen / stale bundle)

If you see a white screen or stale UI, do a full clean and rebuild:

1. **Clear caches**
   ```bash
   watchman watch-del-all          # if you have Watchman
   npm run clean                   # removes node_modules/.cache
   npm run clean:ios               # removes ios/build, Pods, Podfile.lock
   ```

2. **Reinstall Pods**
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Start Metro with a clean bundle**
   ```bash
   npm run start:reset             # or: npx react-native start --reset-cache
   ```

4. **In another terminal, run the app**
   ```bash
   npm run ios                     # builds and launches simulator
   # or if Metro is already running:
   npm run ios:no-packager
   ```

---

## If the app doesn't display on the simulator

Your project path contains a **space** (`Elite App`). Xcode and React Native's codegen scripts can fail or behave oddly with spaces in paths.

### Recommended: Use a path without spaces

1. **Move or clone the project** to a path with no spaces, for example:
   ```bash
   mv "/Users/$(whoami)/Desktop/Elite App/Elite-App" ~/Desktop/EliteApp
   ```

2. **Open and run from the new location:**
   ```bash
   cd ~/Desktop/EliteApp
   npm run start          # Terminal 1: Metro
   npm run ios            # Terminal 2: Build and run on simulator
   ```

3. Ensure the **backend** is running at `http://localhost:5260` (e.g. from `multi-user-auth-app/backend` with `dotnet run`).

### Fixes already applied

- **App name**: `index.js` and `AppDelegate.mm` both use `elitehomeservice` so the native app loads the correct React root.
- **Paths with spaces**: `node_modules/.../script_phases.rb` was patched so codegen works with spaces. This is overwritten by `npm install` unless you use patch-package.

### Run from Xcode

1. `open ios/multiuserauthapp.xcworkspace` (create the workspace with `cd ios && pod install` if needed).
2. Select the **multiuserauthapp** scheme and an iPhone simulator.
3. Press Run. Keep Metro running (`npm run start`) in another terminal.

---

## Release builds and physical devices

- Set your **HTTPS** production API in `src/config/appConfig.ts` (`PRODUCTION_API_BASE_URL`) before archiving for the App Store.
- **Physical device + local HTTP API**: App Transport Security blocks arbitrary HTTP (e.g. `http://192.168.x.x:5260`). Prefer hitting your **HTTPS** deployed API, or use a TLS tunnel for development.

