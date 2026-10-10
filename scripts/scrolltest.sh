#!/bin/bash
# Scrolls the open note continuously for ~5s inside a QUIRE_DEBUG build and samples CPU of Quire + WebKit helpers.
cd "$(dirname "$0")/.."
NOTE=${1:-Study/Complete Javascript/objects-and-classes.md}
swift scripts/debug.swift js "location.hash='#/n/'+encodeURIComponent('$NOTE')"
sleep 1.5
swift scripts/debug.swift js "(()=>{const el=document.querySelector('.reader-scroll');let d=1,t0=performance.now();function f(){el.scrollTop+=6*d;if(el.scrollTop+el.clientHeight>=el.scrollHeight-2)d=-1;if(el.scrollTop<=0)d=1;if(performance.now()-t0<6000)requestAnimationFrame(f)}requestAnimationFrame(f)})()"
sleep 1.5
QP=$(pgrep -x Quire | head -1)
PIDS="$QP $(pgrep -f 'com.apple.WebKit' | tr '\n' ' ')"
top -l 3 -s 1 -stats pid,command,cpu $(for p in $PIDS; do printf -- "-pid %s " $p; done) | awk '/^PID/{n++} n==3 && $1 ~ /^[0-9]+$/ {print}' | sort -k3 -nr | head -5
