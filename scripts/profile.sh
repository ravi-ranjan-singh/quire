#!/bin/bash
# Realistic memory/CPU profile: launch, read, image-heavy note, browse 10 notes, collapse sidebar, scroll, idle.
# usage: scripts/profile.sh [binary] [web dir]   (runs the binary with QUIRE_DEBUG=1)
cd "$(dirname "$0")/.."
BIN=${1:-.build/release/Quire}
d() { swift scripts/debug.swift "$@"; }
mem() { ./scripts/measure.sh 2>/dev/null | awk '/WebContent|total/' | tr -s ' ' | paste -sd' ' -; }
open_note() { d js "location.hash='#/n/'+encodeURIComponent('$1')${2:-}"; }
pkill -x Quire; sleep 1
if [ -n "${2:-}" ]; then (QUIRE_DEBUG=1 QUIRE_WEB_DIR=$2 nohup "$BIN" >/tmp/quire.log 2>&1 &); else (QUIRE_DEBUG=1 nohup "$BIN" >/tmp/quire.log 2>&1 &); fi
sleep 2.5
d js "quire.command('theme:paper'); quire.command('mode:light'); location.hash='#/'"; sleep 8
echo "1. Launched, Home, idle          $(mem)"
open_note "Study/System Design/HLD/Concepts/Consistent Hashing.md"; sleep 8
echo "2. Typical note (3 images)       $(mem)"
open_note "Study/System Design/HLD/Concepts/Saga.md" "; setTimeout(()=>{const e=document.querySelector('.reader-scroll');e.scrollTop=e.scrollHeight},2000)"; sleep 8
echo "3. Saga (9 images), scrolled     $(mem)"
for n in "Study/Complete Javascript/objects-and-classes.md" "Study/Complete Javascript/scopes-and-closures.md" "Study/React/Part 1.md" "Study/System Design/HLD/Async Communication/Kafka.md" "Study/System Design/LLD/json-parser-lld.md" "Twitter/bookmarks.md" "Study/System Design/HLD/Basic/03. CAP theorem.md" "Study/System Design/HLD/Database/Indexing.md"; do open_note "$n"; sleep 1.5; done; sleep 8
echo "4. After browsing 10 notes       $(mem)"
d js "quire.command('toggleSidebar')"; sleep 6
echo "5. Sidebar collapsed             $(mem)"
d js "quire.command('toggleSidebar')"; sleep 1
echo "6. Scrolling CPU:"; ./scripts/scrolltest.sh | head -3 | sed 's/^/     /'
sleep 6; echo "7. After scroll test, idle       $(mem)"
