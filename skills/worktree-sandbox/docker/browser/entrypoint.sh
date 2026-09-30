#!/bin/sh
# Chromium binds CDP to loopback only (9223); socat republishes it on 9222.
set -e

export DISPLAY=:99
SCREEN="${SCREEN:-1440x900x24}"
W="${SCREEN%%x*}"
REST="${SCREEN#*x}"
H="${REST%%x*}"

rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
Xvfb :99 -screen 0 "$SCREEN" -nolisten tcp >/dev/null 2>&1 &
i=0
while [ ! -e /tmp/.X11-unix/X99 ] && [ "$i" -lt 100 ]; do sleep 0.1; i=$((i + 1)); done

fluxbox >/dev/null 2>&1 &
x11vnc -display :99 -forever -shared -nopw -localhost -rfbport 5900 -quiet >/dev/null 2>&1 &
websockify --web /usr/share/novnc 7900 localhost:5900 >/dev/null 2>&1 &
socat TCP-LISTEN:9222,fork,reuseaddr TCP:127.0.0.1:9223 &

echo "browser ready: view on :7900, CDP on :9222, start url ${START_URL:-about:blank}"

while true; do
  rm -f /profile/SingletonLock /profile/SingletonSocket /profile/SingletonCookie
  chromium \
    --no-sandbox \
    --no-first-run \
    --no-default-browser-check \
    --disable-dev-shm-usage \
    --user-data-dir=/profile \
    --remote-debugging-port=9223 \
    --window-position=0,0 \
    --window-size="$W,$H" \
    "${START_URL:-about:blank}" || true
  echo "chromium exited; restarting in 1s"
  sleep 1
done
