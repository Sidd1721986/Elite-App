# iOS Setup (Elite App)

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

1. `open ios/EliteAppTemp.xcworkspace`
2. Select scheme **EliteAppTemp** and an iPhone simulator.
3. Press Run. Keep Metro running (`npm run start`) in another terminal.
