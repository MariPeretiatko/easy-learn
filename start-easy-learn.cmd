@echo off
setlocal
cd /d "%~dp0"
set "EASY_LEARN_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "EASY_LEARN_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\vite\bin\vite.js" (
  echo Install dependencies first: npm install
  pause
  exit /b 1
)
echo Easy Learn: http://127.0.0.1:5173
echo Keep this window open. Press Ctrl+C to stop.
"%EASY_LEARN_NODE%" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort
