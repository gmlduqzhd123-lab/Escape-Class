@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. See README.md.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4173/classroom-escape/ in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
node scripts/serve.mjs
pause
