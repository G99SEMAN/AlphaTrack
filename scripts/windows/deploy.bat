@echo off
title AlphaTrack - Deploy (NAS + Mini-PC)
color 0B
cls

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set EXITCODE=%errorlevel%

if %EXITCODE% neq 0 (
    echo.
    echo  FEHLER: Deploy fehlgeschlagen. Details siehe oben.
)

echo.
pause
exit /b %EXITCODE%
