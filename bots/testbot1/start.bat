@echo off
title TestBot 1
set PYTHONPATH=%~dp0..
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
