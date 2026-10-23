@echo off
title TraceAcc Launcher
echo ===================================================
echo               Starting TraceAcc Pro
echo ===================================================
echo.

:: Set root directory to script location
cd /d "%~dp0"

:: 1. Start Backend Server
echo [1/3] Starting Backend Server (FastAPI on port 8000)...
if exist "backend\venv\Scripts\activate.bat" (
    start "TraceAcc Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && call "%~dp0backend\venv\Scripts\activate.bat" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
) else if exist "venv\Scripts\activate.bat" (
    start "TraceAcc Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && call "%~dp0venv\Scripts\activate.bat" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
) else (
    start "TraceAcc Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
)

:: 2. Start Frontend Server
echo [2/3] Starting Frontend Server (Vite on port 5173)...
start "TraceAcc Frontend (Port 5173)" cmd /k "cd /d "%~dp0money-muling-frontend" && npm run dev"

:: 3. Wait briefly for servers to initialize
echo [3/3] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

:: 4. Open Chrome at http://localhost:5173
echo Opening Chrome at http://localhost:5173 ...
start chrome "http://localhost:5173" 2>nul || start "" "http://localhost:5173"

echo.
echo ===================================================
echo  TraceAcc is now running!
echo  - Backend API: http://127.0.0.1:8000 (Docs: /docs)
echo  - Frontend UI: http://localhost:5173
echo ===================================================
echo.
pause
