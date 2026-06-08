#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <magnet-uri|torrent-file|torrent-url> [save-path]" >&2
  exit 2
fi

ITEM="$1"
HOME_DIR="${HOME:-$(pwd)}"
SAVE_PATH="${2:-$HOME_DIR/media/downloads}"
PROFILE="${QBT_PROFILE:-$HOME_DIR/media/qbt-profile}"
WEB_PORT="${QBT_WEB_PORT:-8080}"

mkdir -p "$SAVE_PATH"
"$(dirname "$0")/qbt-start.sh" >/dev/null

qbittorrent-nox \
  --profile="$PROFILE" \
  --webui-port="$WEB_PORT" \
  --save-path="$SAVE_PATH" \
  --sequential \
  --first-and-last \
  --skip-dialog=true \
  "$ITEM"

echo "Added to qBittorrent"
echo "WebUI: http://127.0.0.1:$WEB_PORT"
echo "Save path: $SAVE_PATH"
