#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <movie-file> [language...]" >&2
  echo "Example: $0 \$HOME/media/downloads/movie.mkv es en" >&2
  exit 2
fi

MOVIE="$1"
shift || true
if [[ $# -gt 0 ]]; then
  LANGS=("$@")
else
  LANGS=(es en)
fi
HOME_DIR="${HOME:-$(pwd)}"
SUB_DIR="${SUB_DIR:-$HOME_DIR/media/subtitles}"

if [[ ! -f "$MOVIE" ]]; then
  echo "Movie not found: $MOVIE" >&2
  exit 1
fi

mkdir -p "$SUB_DIR"

args=()
for lang in "${LANGS[@]}"; do
  args+=("-l" "$lang")
done

subliminal download "${args[@]}" -d "$SUB_DIR" "$MOVIE"
echo "Subtitles directory: $SUB_DIR"
