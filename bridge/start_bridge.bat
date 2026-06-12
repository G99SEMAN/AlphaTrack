@echo off
title AlphaTrack Bridge
cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [FEHLER] Python nicht gefunden!
    echo Bitte Python 3.10+ installieren: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Pruefe Abhaengigkeiten...
python -m pip install -r requirements.txt --quiet --disable-pip-version-check
if %errorlevel% neq 0 (
    echo [FEHLER] Abhaengigkeiten konnten nicht installiert werden.
    pause
    exit /b 1
)

:loop
python main.py
if %errorlevel% == 75 (
    echo.
    echo [BRIDGE] Neustart in 3 Sekunden...
    timeout /t 3 /nobreak >nul
    goto loop
)

echo.
echo Bridge beendet. Druecke eine Taste zum Schliessen...
pause >nul
