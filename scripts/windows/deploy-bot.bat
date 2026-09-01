@echo off
setlocal EnableDelayedExpansion
title Deploy Bot

set "BOT=%~1"
if "!BOT!"=="" goto :ask

:check
if "!BOT!"=="" (
    echo [FEHLER] Kein Bot-Name angegeben.
    pause
    exit /b 1
)

set "REPO_ROOT=%~dp0..\.."
REM Trading-Rechner-Zugangsdaten -- bei Bedarf anpassen
set "TRADING_RECHNER_HOST=192.168.1.100"
set "TRADING_RECHNER_USER=deinuser"
set "TRADING_RECHNER_KEY=%USERPROFILE%\.ssh\alphatrack_deploy"
set "TRADING_RECHNER_TARGET=C:\Users\PC\Desktop\AlphaTrack\bots"

echo.
echo  Bot:     !BOT!
echo  Ziel:    !TRADING_RECHNER_USER!@!TRADING_RECHNER_HOST!:!TRADING_RECHNER_TARGET!\!BOT!
echo  Quelle:  !REPO_ROOT!\bots\!BOT!
echo.

if not exist "!REPO_ROOT!\bots\!BOT!" (
    echo [FEHLER] Bot-Ordner nicht gefunden: !REPO_ROOT!\bots\!BOT!
    pause
    exit /b 1
)

echo  Kopiere...
tar cf - -C "!REPO_ROOT!\bots" "!BOT!" | ssh -i "!TRADING_RECHNER_KEY!" !TRADING_RECHNER_USER!@!TRADING_RECHNER_HOST! "tar xf - -C \"!TRADING_RECHNER_TARGET!\""

if !errorlevel! neq 0 (
    echo.
    echo  [FEHLER] Uebertragung fehlgeschlagen. SSH-Key und Verbindung pruefen.
    pause
    exit /b 1
)

echo.
echo  [OK] !BOT! erfolgreich auf Trading-Rechner deployt.
pause
exit /b 0

:ask
set /p "BOT=Bot-Name eingeben (z.B. scalpingv1): "
goto :check
