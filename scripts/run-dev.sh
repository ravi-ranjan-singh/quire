#!/bin/bash
# Builds the Swift shell and runs it against the live web/ folder with debug hooks enabled.
# The binary is signed with the local certificate so macOS remembers its folder permissions between builds.
# usage: scripts/run-dev.sh [vault path]
set -euo pipefail
cd "$(dirname "$0")/.."
npm run --silent build:web
swift build -c release 2>&1 | grep -E "error|Compiling|Build complete" || true
codesign --force --sign "Quire Local Signing" --identifier com.ravi.quire.dev .build/release/Quire 2>/dev/null \
  || echo "warning: local signing certificate missing; macOS may prompt for folder access"
pkill -x Quire || true
QUIRE_DEBUG=1 QUIRE_WEB_DIR="$PWD/web" ${1:+QUIRE_VAULT="$1"} nohup .build/release/Quire >/tmp/quire.log 2>&1 &
echo "running (logs: /tmp/quire.log)"
