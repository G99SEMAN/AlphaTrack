@echo off
title AlphaTrack - Dev Server
color 0A
cls

echo.
echo  ==========================================
echo   AlphaTrack - Development Server
echo  ==========================================
echo.

pushd "%~dp0\..\.."

where npm >nul 2>&1
if errorlevel 1 (
    echo  FEHLER: npm nicht gefunden!
    echo  Bitte Node.js installieren: https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo  Lokale URL:    http://localhost:3000
echo  Netzwerk URL:  http://%IP%:3000
echo.
echo  Server laeuft... Fenster schliessen zum Beenden.
echo  ------------------------------------------
echo.

start /b cmd /c "timeout /t 4 /nobreak > nul && start http://localhost:3000"

npm run dev

echo.
echo  Server wurde beendet.
pause
