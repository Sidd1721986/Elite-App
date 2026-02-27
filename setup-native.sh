#!/bin/bash
# Run this script once in Terminal with: bash setup-native.sh
# It installs CocoaPods (requires admin password) and links iOS native modules.

set -e

echo "📦 Installing CocoaPods..."
sudo gem install cocoapods

echo "🔗 Running pod install..."
cd "$(dirname "$0")/ios"
pod install

echo ""
echo "✅ Done! You can now run the app with:"
echo "   npx react-native run-ios"
echo "   (in a new terminal tab if Metro is already running)"
