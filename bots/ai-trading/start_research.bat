@echo off
title AI-Trading (autoresearch Loop)
set PYTHONPATH=%~dp0..\bridge

if "%ANTHROPIC_API_KEY%"=="" (
    echo [FEHLER] ANTHROPIC_API_KEY ist nicht gesetzt!
    echo Setze ihn mit:  set ANTHROPIC_API_KEY=sk-ant-...
    echo Oder trage ihn dauerhaft in die Systemumgebungsvariablen ein.
    pause
    exit /b 1
)

echo [OK] API Key gefunden.
echo [START] autoresearch Loop wird gestartet...
echo.
python autoresearch.py %*
pause
