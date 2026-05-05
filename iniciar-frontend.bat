@echo off
setlocal
title Metodo Chronos Frontend
echo ==========================================
echo Starting Metodo Chronos Frontend...
echo ==========================================

cd /d "%~dp0frontend"
if exist node_modules (
    npm run dev
) else (
    echo [ERROR] node_modules not found in frontend directory.
    echo Please run 'npm install' in the frontend folder first.
    pause
)
pause
