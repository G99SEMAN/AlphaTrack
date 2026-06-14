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
set "MINIPC_HOST=192.168.178.37"
set "MINIPC_USER=pc"
set "MINIPC_KEY=C:\Users\G99SEMAN\.ssh\alphatrack_deploy"
set "MINIPC_TARGET=C:\Users\PC\Desktop\AlphaTrack\bots"

echo.
echo  Bot:     !BOT!
echo  Ziel:    !MINIPC_USER!@!MINIPC_HOST!:!MINIPC_TARGET!\!BOT!
echo  Quelle:  !REPO_ROOT!\bots\!BOT!
echo.

if not exist "!REPO_ROOT!\bots\!BOT!" (
    echo [FEHLER] Bot-Ordner nicht gefunden: !REPO_ROOT!\bots\!BOT!
    pause
    exit /b 1
)

echo  Kopiere...
scp -r -i "!MINIPC_KEY!" "!REPO_ROOT!\bots\!BOT!" !MINIPC_USER!@!MINIPC_HOST!:"!MINIPC_TARGET!/"

if !errorlevel! neq 0 (
    echo.
    echo  [FEHLER] SCP fehlgeschlagen. SSH-Key und Verbindung pruefen.
    pause
    exit /b 1
)

echo.
echo  [OK] !BOT! erfolgreich auf Mini-PC deployt.
pause
exit /b 0

:ask
set /p "BOT=Bot-Name eingeben (z.B. scalpingv1): "
goto :check
