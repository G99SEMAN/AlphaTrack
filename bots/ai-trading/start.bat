@echo off
title AI-Trading (Live)
set PYTHONPATH=%~dp0..\..\bridge
echo Pruefe Abhaengigkeiten...
python -m pip install -r "%~dp0requirements.txt" --quiet --disable-pip-version-check
if %errorlevel% neq 0 (
    echo [FEHLER] Abhaengigkeiten konnten nicht installiert werden.
    pause
    exit /b 1
)
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
