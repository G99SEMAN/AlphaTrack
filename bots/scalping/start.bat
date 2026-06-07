@echo off
title FVG-Scalper
:loop
python main.py
if %errorlevel% == 75 goto loop
pause
