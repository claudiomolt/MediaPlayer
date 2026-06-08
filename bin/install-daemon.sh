#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bin/install-daemon.sh" >&2
  exit 1
fi

APP_DIR="${MEDIA_PLAYER_DIR:-$(pwd)}"
RUN_USER="${MEDIA_PLAYER_USER:-${SUDO_USER:-media}}"
RUN_GROUP="${MEDIA_PLAYER_GROUP:-$(id -gn "$RUN_USER" 2>/dev/null || echo "$RUN_USER")}"
HOME_DIR="$(getent passwd "$RUN_USER" | cut -d: -f6)"

if [[ -z "$HOME_DIR" ]]; then
  echo "Could not resolve home directory for user: $RUN_USER" >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
QBT_BIN="${QBT_BIN:-$(command -v qbittorrent-nox || true)}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"

if [[ -z "$NODE_BIN" ]]; then
  echo "node not found. Set NODE_BIN=/path/to/node" >&2
  exit 1
fi

if [[ -z "$QBT_BIN" ]]; then
  echo "qbittorrent-nox not found. Set QBT_BIN=/path/to/qbittorrent-nox" >&2
  exit 1
fi

MEDIA_ROOT="${MEDIA_ROOT:-$HOME_DIR/media/downloads}"
SUB_DIR="${SUB_DIR:-$HOME_DIR/media/subtitles}"
QBT_PROFILE="${QBT_PROFILE:-$HOME_DIR/media/qbt-profile}"
AUTH_FILE="${MEDIA_CENTER_AUTH_FILE:-$HOME_DIR/media/media-center-auth.txt}"
MEDIA_CENTER_PORT="${MEDIA_CENTER_PORT:-3342}"
MEDIA_CENTER_AUTH_PORT="${MEDIA_CENTER_AUTH_PORT:-3343}"
QBT_WEB_PORT="${QBT_WEB_PORT:-8080}"
QBT_TORRENT_PORT="${QBT_TORRENT_PORT:-6881}"

install -d -o "$RUN_USER" -g "$RUN_GROUP" "$MEDIA_ROOT" "$SUB_DIR" "$QBT_PROFILE" "$(dirname "$AUTH_FILE")"

if [[ ! -f "$AUTH_FILE" ]]; then
  AUTH_USER="${MEDIA_CENTER_AUTH_USER:-media}"
  AUTH_PASSWORD="${MEDIA_CENTER_AUTH_PASSWORD:-$(openssl rand -base64 24 | tr -d '\n')}"
  umask 077
  {
    echo "user=$AUTH_USER"
    echo "password=$AUTH_PASSWORD"
  } > "$AUTH_FILE"
  chown "$RUN_USER:$RUN_GROUP" "$AUTH_FILE"
  echo "Created auth file: $AUTH_FILE"
  echo "Auth user: $AUTH_USER"
  echo "Auth password: $AUTH_PASSWORD"
fi

cat >/etc/systemd/system/mediaplayer-qbt.service <<EOF
[Unit]
Description=MediaPlayer qBittorrent
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
Group=$RUN_GROUP
Type=simple
ExecStart=$QBT_BIN --profile=$QBT_PROFILE --webui-port=$QBT_WEB_PORT --torrenting-port=$QBT_TORRENT_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/mediaplayer.service <<EOF
[Unit]
Description=MediaPlayer Webapp
After=network-online.target mediaplayer-qbt.service
Wants=network-online.target mediaplayer-qbt.service

[Service]
User=$RUN_USER
Group=$RUN_GROUP
Type=simple
WorkingDirectory=$APP_DIR
Environment=MEDIA_CENTER_PORT=$MEDIA_CENTER_PORT
Environment=MEDIA_ROOT=$MEDIA_ROOT
Environment=SUB_DIR=$SUB_DIR
Environment=QBT_URL=http://127.0.0.1:$QBT_WEB_PORT
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/mediaplayer-auth-proxy.service <<EOF
[Unit]
Description=MediaPlayer Auth Proxy
After=network-online.target mediaplayer.service
Wants=network-online.target mediaplayer.service

[Service]
User=$RUN_USER
Group=$RUN_GROUP
Type=simple
WorkingDirectory=$APP_DIR
Environment=MEDIA_CENTER_AUTH_PORT=$MEDIA_CENTER_AUTH_PORT
Environment=MEDIA_CENTER_TARGET=http://127.0.0.1:$MEDIA_CENTER_PORT
Environment=MEDIA_CENTER_AUTH_FILE=$AUTH_FILE
ExecStart=$NODE_BIN $APP_DIR/auth-proxy.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if [[ -n "$CLOUDFLARED_BIN" ]]; then
  cat >/etc/systemd/system/mediaplayer-cloudflared.service <<EOF
[Unit]
Description=MediaPlayer Cloudflare Quick Tunnel
After=network-online.target mediaplayer-auth-proxy.service
Wants=network-online.target mediaplayer-auth-proxy.service

[Service]
User=$RUN_USER
Group=$RUN_GROUP
Type=simple
ExecStart=$CLOUDFLARED_BIN tunnel --no-autoupdate --url http://127.0.0.1:$MEDIA_CENTER_AUTH_PORT
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
EOF
fi

systemctl daemon-reload
systemctl enable --now mediaplayer-qbt.service mediaplayer.service mediaplayer-auth-proxy.service

if [[ -n "$CLOUDFLARED_BIN" ]]; then
  systemctl enable --now mediaplayer-cloudflared.service
fi

echo "MediaPlayer installed."
echo "Local URL: http://127.0.0.1:$MEDIA_CENTER_PORT"
echo "Auth proxy: http://127.0.0.1:$MEDIA_CENTER_AUTH_PORT"
echo "Media root: $MEDIA_ROOT"
echo "Subtitles: $SUB_DIR"
