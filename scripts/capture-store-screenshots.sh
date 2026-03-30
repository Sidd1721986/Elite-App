#!/usr/bin/env bash
# Capture store screenshots from the booted iOS Simulator and (optional) Android device/emulator.
# You must navigate to each screen manually, then run this script or press Enter between shots.
#
# iOS:  boot the Simulator model that matches App Store required resolution (see docs/STORE-SUBMISSION.md)
# Android: adb devices must show one device/emulator
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT/store-assets/ios"
AND_DIR="$ROOT/store-assets/android"
mkdir -p "$IOS_DIR" "$AND_DIR"

stamp() { date +%Y%m%d-%H%M%S; }

echo "=== iOS (booted Simulator) ==="
if xcrun simctl list devices | grep -q Booted; then
  out="$IOS_DIR/ios-$(stamp).png"
  xcrun simctl io booted screenshot "$out"
  echo "Saved: $out"
  sips -g pixelWidth -g pixelHeight "$out" 2>/dev/null || true
else
  echo "No booted Simulator. Open Xcode → run app on a Simulator, then run again."
fi

echo ""
echo "=== Android (adb) ==="
if command -v adb >/dev/null 2>&1 && adb devices | grep -qE 'device$'; then
  out="$AND_DIR/android-$(stamp).png"
  adb exec-out screencap -p >"$out"
  echo "Saved: $out"
else
  echo "Skip: adb not found or no device/emulator (adb devices)."
fi

echo ""
echo "Rename files to 01-login.png, 02-home.png, … and verify dimensions against docs/STORE-SUBMISSION.md"
