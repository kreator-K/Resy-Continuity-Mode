@echo off
cd /d "%~dp0"
echo Restaurant Continuity Mode
py -m venv .venv
if errorlevel 1 pause & exit /b 1
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 pause & exit /b 1
start "" http://127.0.0.1:8765
.venv\Scripts\python.exe run.py
pause
