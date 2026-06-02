@echo off
title AlphaTrack Bridge Setup
cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [FEHLER] Python nicht gefunden!
    echo Bitte Python 3.10+ installieren: https://www.python.org/downloads/
    pause
    exit /b 1
)

pip install requests --quiet --disable-pip-version-check

python setup.py
