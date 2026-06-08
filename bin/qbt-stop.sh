#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME:-$(pwd)}"
PROFILE="${QBT_PROFILE:-$HOME_DIR/media/qbt-profile}"

if ! pgrep -f "qbittorrent-nox .*--profile=$PROFILE" >/dev/null; then
  echo "qBittorrent is not running"
  exit 0
fi

pkill -f "qbittorrent-nox .*--profile=$PROFILE"
echo "qBittorrent stopped"
