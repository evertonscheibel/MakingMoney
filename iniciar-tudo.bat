@echo off
setlocal
title Metodo Chronos - Sistema Completo

echo ============================================================
echo           Iniciando Metodo Chronos - Sistema Completo
echo ============================================================
echo.

echo [1/2] Iniciando Backend em nova janela...
start "Metodo Chronos Backend" cmd /k "cd /d "%~dp0" && iniciar-backend.bat"

echo.
echo Aguardando o backend inicializar (5 segundos)...
timeout /t 5 /nobreak > nul

echo.
echo [2/2] Iniciando Frontend em nova janela...
start "Metodo Chronos Frontend" cmd /k "cd /d "%~dp0" && iniciar-frontend.bat"

echo.
echo ============================================================
echo   Tudo pronto! O backend e o frontend estao sendo iniciados.
echo ============================================================
echo.
timeout /t 5
