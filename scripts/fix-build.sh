#!/bin/bash
# Script to resolve complex build failures by purging native caches and ensuring dependencies

PROJECT_DIR="/Users/siddharthsengar/Desktop/multi-user-auth-app"
cd $PROJECT_DIR

echo "🌪️  Initiating Nuclear Clean..."

# Check for cmake (required for Hermes if pre-builts are missing)
if ! command -v cmake &> /dev/null; then
    echo "⚠️  WARNING: 'cmake' not found. If Hermes needs to build from source, the build will fail."
    echo "👉 Please run: brew install cmake"
    echo "--------------------------------------------------"
fi

echo "🧹 Clearing Metro and Watchman caches..."
watchman watch-del-all 2>/dev/null
rm -rf node_modules/.cache/metro 2>/dev/null
rm -rf $TMPDIR/metro-* 2>/dev/null

echo "🗑️  Purging Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/multiuserauthapp-* 2>/dev/null

echo "🗑️  Purging Native Build Folders..."
rm -rf ios/Pods 2>/dev/null
rm -rf ios/Podfile.lock 2>/dev/null
rm -rf ios/build 2>/dev/null
rm -rf android/app/build 2>/dev/null

echo "📦 Re-installing dependencies..."
# Use --force to ensure Hermes binaries are re-downloaded
npm install --legacy-peer-deps --force

echo "📦 Re-linking iOS Pods (triggers Codegen)..."
npx pod-install ios

echo "✅ Nuclear Clean complete!"
echo "👉 Now run: npm run ios"
