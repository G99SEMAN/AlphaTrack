@echo off
title AlphaTrack - Dev-Sync (Hot-Reload NAS :3003)
color 0B

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-dev.ps1" %*
set EXITCODE=%errorlevel%

if %EXITCODE% neq 0 (
    echo.
    echo  FEHLER: Dev-Sync fehlgeschlagen. Details siehe oben.
)

echo.
pause
exit /b %EXITCODE%
