@echo off
title AlphaTrack - Deploy zu NAS
color 0B
cls

:: ==========================================
::  Konfiguration - bitte anpassen
:: ==========================================
set NAS_USER=G99SEMAN
set NAS_HOST=192.168.178.3
set NAS_PORT=88
set NAS_PROJECT_DIR=/volume1/docker/alphatrack
:: ==========================================

echo.
echo  ==========================================
echo   AlphaTrack - Deploy zu Synology NAS
echo  ==========================================
echo.

echo  [1/2] Code zu GitHub pushen...
git push
if %errorlevel% neq 0 (
    echo.
    echo  FEHLER: git push fehlgeschlagen.
    pause
    exit /b 1
)

echo.
echo  [2/2] Update auf NAS ausfuehren...
echo        Verbinde mit %NAS_USER%@%NAS_HOST%...
echo.

ssh -p %NAS_PORT% %NAS_USER%@%NAS_HOST% "bash %NAS_PROJECT_DIR%/scripts/nas-update.sh"

if %errorlevel% neq 0 (
    echo.
    echo  FEHLER: Update auf NAS fehlgeschlagen.
    pause
    exit /b 1
)

echo.
echo  Deploy abgeschlossen!
echo  AlphaTrack ist jetzt auf dem NAS aktualisiert.
echo  ==========================================
echo.
pause
