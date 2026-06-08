# MediaPlayer

Local media center for a living-room HDMI setup: catalog browsing, local library scanning, qBittorrent status, subtitle lookup, and MPV playback.

## Features

- Movie and series catalog metadata via Cinemeta/Stremio.
- HDMI-friendly poster rail with keyboard navigation.
- Local library scan with detected subtitles.
- qBittorrent progress strip.
- Subtitle lookup with `subliminal`.
- MPV playback on an HDMI DRM connector.
- Optional Basic Auth proxy for tunnels.

Use it only with media you own, public-domain media, or legal torrents.

## Requirements

- Node.js 20+
- qBittorrent-nox
- mpv
- subliminal
- Optional: cloudflared or ngrok for remote access

## Run

```bash
git clone https://github.com/claudiomolt/MediaPlayer.git
cd MediaPlayer
npm start
```

Default local URL: `http://127.0.0.1:3340`

Useful environment variables:

```bash
MEDIA_CENTER_PORT=3342
MEDIA_ROOT="$HOME/media/downloads"
SUB_DIR="$HOME/media/subtitles"
QBT_URL="http://127.0.0.1:8080"
HDMI_CONNECTOR="HDMI-A-1"
```

## Install As Daemon

From the cloned repo:

```bash
sudo bin/install-daemon.sh
```

That installs and starts:

- `mediaplayer-qbt.service`
- `mediaplayer.service`
- `mediaplayer-auth-proxy.service`
- `mediaplayer-cloudflared.service` if `cloudflared` is installed

The installer creates:

- media root: `$HOME/media/downloads`
- subtitles: `$HOME/media/subtitles`
- qBittorrent profile: `$HOME/media/qbt-profile`
- auth file: `$HOME/media/media-center-auth.txt`

Override defaults:

```bash
sudo MEDIA_CENTER_PORT=3342 \
  MEDIA_CENTER_AUTH_PORT=3343 \
  MEDIA_ROOT="$HOME/media/downloads" \
  SUB_DIR="$HOME/media/subtitles" \
  bin/install-daemon.sh
```

Check services:

```bash
systemctl status mediaplayer-qbt mediaplayer mediaplayer-auth-proxy mediaplayer-cloudflared
```

## Commands

```bash
bin/qbt-start.sh
bin/qbt-add.sh "legal-torrent-or-file" "$HOME/media/downloads"
bin/fetch-subs.sh "$HOME/media/downloads/movie.mkv" es en
bin/play-hdmi.sh --takeover "$HOME/media/downloads/movie.mkv"
bin/qbt-stop.sh
```

`play-hdmi.sh --takeover` stops GDM, unbinds fbcon, and launches MPV on the configured HDMI connector.

## Auth Proxy

Create an auth file:

```bash
mkdir -p "$HOME/media"
cat > "$HOME/media/media-center-auth.txt" <<'EOF'
user=change-me
password=change-me-too
EOF
```

Run:

```bash
MEDIA_CENTER_TARGET=http://127.0.0.1:3342 \
MEDIA_CENTER_AUTH_FILE="$HOME/media/media-center-auth.txt" \
node auth-proxy.js
```

Then expose `http://127.0.0.1:3343` with your tunnel of choice.

## Systemd

See `systemd/` for example units. Copy them to `/etc/systemd/system/`, adjust `User`, `WorkingDirectory`, `ExecStart`, and environment paths, then enable the services.
