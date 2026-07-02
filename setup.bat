@echo off
title AlphaTrack Setup Wizard
color 0B
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\setup-wizard.ps1" -RepoRoot "%~dp0"
if %errorlevel% neq 0 (
    echo.
    echo  Einrichtung fehlgeschlagen / Setup failed.
    echo  Bitte Fehlermeldung oben pruefen / Please check the error message above.
)
echo.
pause
exit /b %errorlevel%
