#!/bin/bash
# Builds Quire.app into build/ and installs it to ~/Applications.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run --silent build:web
swift build -c release

APP=build/Quire.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web/dist"
cp .build/release/Quire "$APP/Contents/MacOS/Quire"
cp web/index.html web/styles.css "$APP/Contents/Resources/web/"
cp web/dist/app.js "$APP/Contents/Resources/web/dist/"

# Icon
ICONSET=build/Quire.iconset
rm -rf "$ICONSET" && mkdir -p "$ICONSET"
swift scripts/make-icon.swift build/icon-1024.png
for s in 16 32 128 256 512; do
  sips -z $s $s build/icon-1024.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) build/icon-1024.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Quire.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Quire</string>
  <key>CFBundleDisplayName</key><string>Quire</string>
  <key>CFBundleIdentifier</key><string>com.ravi.quire</string>
  <key>CFBundleExecutable</key><string>Quire</string>
  <key>CFBundleIconFile</key><string>Quire</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>A calm reader for your notes.</string>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP" >/dev/null 2>&1
mkdir -p ~/Applications
rm -rf ~/Applications/Quire.app
cp -R "$APP" ~/Applications/Quire.app
echo "Installed → ~/Applications/Quire.app"
