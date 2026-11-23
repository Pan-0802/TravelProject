@echo off
title Travel Planner - Dev Server
cd /d "%~dp0"

rem --- Make sure Node.js / npm is reachable (PATH may be stale after a fresh install) ---
where npm >nul 2>nul
if errorlevel 1 set "PATH=D:\Nodejs;%PATH%"
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found.
  echo Please install Node.js 22.12+ or 24 from https://nodejs.org , then run this file again.
  echo If Node.js is installed somewhere else, open this file and change D:\Nodejs to that folder.
  echo.
  pause
  exit /b 1
)

rem --- First run: install dependencies ---
if not exist "node_modules" (
  echo [1/2] First run detected. Installing dependencies, this may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo Install failed. Check your network, then run this file again.
    pause
    exit /b 1
  )
) else (
  echo [1/2] Dependencies already installed.
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=24?0:1)"
if errorlevel 1 (
  echo [ERROR] Node.js 20.19+, 22.12+ or 24 is required.
  pause
  exit /b 1
)

echo [2/2] Starting dev server on http://localhost:5173 ...
echo.
echo  Keep this window OPEN while using the website.
echo  Close this window to stop the server.
echo.

start "" /b cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:5173/"

if /i "%~1"=="mock" (
  call npm run dev:mock
) else (
  call npm run dev
)

echo.
echo Server stopped. Press any key to close this window.
pause
