@echo off
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Frontend has not been built yet.
  echo Run these two commands once: npm install  then  npm run build
  pause
  exit /b 1
)
node server\index.mjs
if errorlevel 1 pause
