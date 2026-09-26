#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c 'import aiohttp,qrcode,PIL' >/dev/null 2>&1; then
  echo "Installing aiohttp and qrcode..."
  "$PYTHON" -m pip install --user aiohttp 'qrcode[pil]'
fi
exec "$PYTHON" server.py
