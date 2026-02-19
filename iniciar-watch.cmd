@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\tools\watch-noticias-deploy.ps1"
pause
