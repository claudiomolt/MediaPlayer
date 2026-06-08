#!/usr/bin/env bash
set -euo pipefail

CONNECTOR="${HDMI_CONNECTOR:-HDMI-A-1}"
HOME_DIR="${HOME:-$(pwd)}"
MEDIA_ROOT="${MEDIA_ROOT:-$HOME_DIR/media/downloads}"
SUB_DIR="${SUB_DIR:-$HOME_DIR/media/subtitles}"
TAKEOVER=false
SUBTITLE=""

usage() {
  cat >&2 <<'EOF'
Usage: play-hdmi.sh [--takeover] [--sub subtitle-file] [movie-file]

Without movie-file, plays the newest video under $HOME/media/downloads.
--takeover stops GDM and unbinds fbcon so mpv can take DRM master on HDMI.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --takeover)
      TAKEOVER=true
      shift
      ;;
    --sub)
      SUBTITLE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      MOVIE="${1}"
      shift
      ;;
  esac
done

if [[ -z "${MOVIE:-}" ]]; then
  MOVIE="$(find "$MEDIA_ROOT" -type f \( -iname '*.mkv' -o -iname '*.mp4' -o -iname '*.avi' -o -iname '*.mov' -o -iname '*.webm' \) -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
fi

if [[ -z "${MOVIE:-}" || ! -f "$MOVIE" ]]; then
  echo "No movie found. Put a video in $MEDIA_ROOT or pass a file path." >&2
  exit 1
fi

if [[ "$TAKEOVER" == true ]]; then
  sudo systemctl stop gdm 2>/dev/null || true
  echo 0 | sudo tee /sys/class/vtconsole/vtcon0/bind >/dev/null || true
  sudo chmod 666 /dev/dri/card1 /dev/dri/renderD128 2>/dev/null || true
fi

base="$(basename "${MOVIE%.*}")"
sub_args=(--sub-auto=fuzzy --sub-file-paths="$SUB_DIR:$(dirname "$MOVIE")")

if [[ -n "$SUBTITLE" && -f "$SUBTITLE" ]]; then
  sub_args+=(--sub-file="$SUBTITLE")
else
  for ext in srt ass vtt sub; do
    for candidate in "$(dirname "$MOVIE")/$base.$ext" "$SUB_DIR/$base.$ext"; do
      if [[ -f "$candidate" ]]; then
        sub_args+=(--sub-file="$candidate")
        break 2
      fi
    done
  done
fi

exec sudo mpv \
  --vo=drm \
  --drm-connector="$CONNECTOR" \
  --hwdec=auto \
  --fs \
  --osd-level=1 \
  "${sub_args[@]}" \
  "$MOVIE"
