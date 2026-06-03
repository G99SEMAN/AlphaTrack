@echo off
title Breakout v1
set PYTHONPATH=%~dp0..\bridge
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
