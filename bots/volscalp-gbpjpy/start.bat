@echo off
title %~n0
set PYTHONPATH=%~dp0..
python -m pip install -r "%~dp0requirements.txt" --quiet --disable-pip-version-check
if %errorlevel% neq 0 (
    echo [FEHLER] pip install fehlgeschlagen
    pause
    exit /b 1
)
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
