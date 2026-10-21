@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer and restart this script.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Install dependencies first: npx pnpm@10.34.7 install --frozen-lockfile
  pause
  exit /b 1
)
echo Easy Learn: http://127.0.0.1:5173
echo Keep this window open. Press Ctrl+C to stop.
node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort
