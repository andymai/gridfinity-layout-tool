#!/usr/bin/env bash
# Build docs/demo.gif from the Playwright webm recording.
set -euo pipefail

SRC=".demo-recording/demo.webm"
OUT="docs/demo.gif"

[[ -f "$SRC" ]] || { echo "missing $SRC — run 'pnpm demo:record' first" >&2; exit 1; }

# Trim the blank intro, scale, drop to 15fps, and do a single-pass palette.
ffmpeg -y -loglevel error -i "$SRC" -ss 2.0 -t 22 \
  -vf "fps=15,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
  "$OUT"

printf 'wrote %s (%s)\n' "$OUT" "$(du -h "$OUT" | cut -f1)"
