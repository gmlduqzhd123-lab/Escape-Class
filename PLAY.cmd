@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. See README.md.
  pause
  exit /b 1
)
rem The built game (dist) is not stored in the repository, so build it once on first run.
if not exist "dist\index.html" (
  echo The game has not been built yet. Building it once now. This needs an internet connection.
  call npm ci && call npm run build
)
if not exist "dist\index.html" (
  echo The build failed. Check the internet connection, then run PLAY.cmd again. See README.md.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4173/classroom-escape/ in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
node scripts/serve.mjs
pause
