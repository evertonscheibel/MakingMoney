@echo off
setlocal
title Metodo Chronos Backend
echo ==========================================
echo Starting Metodo Chronos Backend...
echo ==========================================

cd /d "%~dp0backend"
if exist node_modules (
    npm run dev
) else (
    echo [ERROR] node_modules not found in backend directory.
    echo Please run 'npm install' in the backend folder first.
    pause
)
pause
