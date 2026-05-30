#!/usr/bin/env bash
set -euo pipefail

missing=0

check_cmd() {
  local name="$1"
  local hint="$2"
  if command -v "$name" >/dev/null 2>&1; then
    printf '✔ %s: ' "$name"
    "$name" --version 2>&1 | head -n 1 || true
  else
    printf '✘ %s missing. %s\n' "$name" "$hint"
    missing=1
  fi
}

check_cmd node "Install Node.js >= 20."
check_cmd opencli "Run: npm install -g @jackwener/opencli"
check_cmd yt-dlp "Run: brew install yt-dlp or pip install -U yt-dlp"
check_cmd ffmpeg "Run: brew install ffmpeg"
check_cmd scenedetect "Run: pip install scenedetect[opencv]"
check_cmd python3 "Install Python 3."

if command -v opencli >/dev/null 2>&1; then
  opencli doctor >/dev/null 2>&1 && printf '✔ opencli doctor\n' || printf '⚠ opencli doctor failed; check Chrome Bridge extension.\n'
fi

python3 - <<'PY' || missing=1
import importlib.util
missing = []
for name in ["scenedetect", "faster_whisper"]:
    if importlib.util.find_spec(name) is None:
        missing.append(name)
    else:
        print(f"✔ python module {name}")
if missing:
    print(f"✘ python modules {', '.join(missing)} missing. Run: pip install scenedetect[opencv] faster-whisper")
    raise SystemExit(1)
PY

if [ "$missing" -eq 1 ]; then
  exit 1
fi
