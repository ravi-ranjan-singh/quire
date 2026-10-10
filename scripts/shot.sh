#!/bin/bash
# Headless-Chrome screenshot of the dev server UI (browser mode, no native shell).
# usage: scripts/shot.sh <out.png> <url> [width] [height] [light|dark]
set -u
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SCHEME=$([ "${5:-light}" = dark ] && echo 0 || echo 1)
PROFILE=$(mktemp -d)
"$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" --force-device-scale-factor=1 \
  --blink-settings=preferredColorScheme=$SCHEME --window-size=${3:-1440},${4:-900} --virtual-time-budget=5000 \
  --screenshot="$1" "$2" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 1 40); do kill -0 $PID 2>/dev/null || break; sleep 0.5; done
kill $PID 2>/dev/null; rm -rf "$PROFILE"
ls -la "$1"
