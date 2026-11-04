#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 or newer is required. See 읽어보세요.txt."
  exit 1
fi
echo "Open http://127.0.0.1:4173/classroom-escape/ in your browser."
echo "Keep this window open while playing. Press Ctrl+C to stop."
node scripts/serve.mjs
