@echo off
chcp 65001 >nul
title Starfall Exchange Local Playtest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
