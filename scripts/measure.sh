#!/bin/bash
# Prints memory footprint and CPU for Quire and the WebKit helper processes it spawned.
# usage: scripts/measure.sh            (Quire must be running; WebKit helpers are matched by start time)
QP=$(pgrep -x Quire | head -1) || { echo "Quire not running"; exit 1; }
START=$(ps -o lstart= -p $QP)
START_S=$(date -j -f "%a %b %d %T %Y" "$START" +%s)
total=0
for p in $QP $(pgrep -f "com.apple.WebKit"); do
  s=$(date -j -f "%a %b %d %T %Y" "$(ps -o lstart= -p $p)" +%s 2>/dev/null) || continue
  [ "$p" != "$QP" ] && { [ $((s - START_S)) -lt 0 ] || [ $((s - START_S)) -gt 15 ]; } && continue
  mb=$(footprint -p $p 2>/dev/null | sed -nE 's/.*Footprint: ([0-9.]+) (MB|KB|GB).*/\1 \2/p' | head -1)
  val=$(echo $mb | awk '{v=$1; if($2=="KB")v/=1024; if($2=="GB")v*=1024; printf "%.1f", v}')
  cpu=$(ps -o %cpu= -p $p | xargs)
  printf "  %-28s %7s MB   cpu %5s%%\n" "$(basename "$(ps -o comm= -p $p)")" "$val" "$cpu"
  total=$(echo "$total + $val" | bc)
done
echo "  total                        $total MB"
