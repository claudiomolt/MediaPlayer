#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME:-$(pwd)}"
PROFILE="${QBT_PROFILE:-$HOME_DIR/media/qbt-profile}"
DOWNLOADS="${QBT_DOWNLOADS:-$HOME_DIR/media/downloads}"
WEB_PORT="${QBT_WEB_PORT:-8080}"
TORRENT_PORT="${QBT_TORRENT_PORT:-6881}"

mkdir -p "$PROFILE" "$DOWNLOADS" "$DOWNLOADS/.incomplete" "$HOME_DIR/media/watch"

if pgrep -f "qbittorrent-nox .*--profile=$PROFILE" >/dev/null; then
  echo "qBittorrent already running on http://127.0.0.1:$WEB_PORT"
  exit 0
fi

qbittorrent-nox \
  --profile="$PROFILE" \
  --webui-port="$WEB_PORT" \
  --torrenting-port="$TORRENT_PORT" \
  --daemon

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:$WEB_PORT/" >/dev/null; then
    echo "qBittorrent ready: http://127.0.0.1:$WEB_PORT"
    echo "Downloads: $DOWNLOADS"
    exit 0
  fi
  sleep 0.25
done

echo "qBittorrent started, but WebUI did not answer yet" >&2
exit 1
