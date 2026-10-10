#!/bin/bash
# Fresh-launch memory test: start Quire (debug), open a note, wait, then report footprint.
# usage: scripts/memtest.sh <binary> [web dir] [note path] [extra js]
cd "$(dirname "$0")/.."
BIN=${1:-.build/release/Quire}
pkill -x Quire; sleep 1
if [ -n "${2:-}" ]; then (QUIRE_DEBUG=1 QUIRE_WEB_DIR=$2 nohup "$BIN" >/tmp/quire.log 2>&1 &); else (QUIRE_DEBUG=1 nohup "$BIN" >/tmp/quire.log 2>&1 &); fi
sleep 3
swift scripts/debug.swift js "${4:-}; location.hash='#/n/'+encodeURIComponent('${3:-Study/System Design/HLD/Concepts/Consistent Hashing.md}')"
sleep 8
./scripts/measure.sh 2>/dev/null
