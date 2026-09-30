# Chromium with a virtual display, live view (noVNC) and a CDP endpoint for agents.
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium xvfb x11vnc novnc websockify socat fluxbox \
      fonts-liberation fonts-noto-color-emoji ca-certificates procps \
 && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
# Strip CRLF in case the file was edited on Windows.
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 7900 9222
ENTRYPOINT ["/entrypoint.sh"]
