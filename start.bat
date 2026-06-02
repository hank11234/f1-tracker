@echo off
title F1 Tracker
echo.
echo  ===========================
echo   F1 TRACKER - Starting up
echo  ===========================
echo.

cd /d "%~dp0"

:: ── Refresh PATH so newly installed Node.js is visible ────────────────────────
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')"`) do set "PATH=%%i"

:: ── Kill any existing instance on port 8000 (old backend) ────────────────────
echo Stopping any existing backend on port 8000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":8000 "') do (
    taskkill /f /t /pid %%a >nul 2>&1
)

:: ── Kill any existing instance on port 5173 (old frontend) ───────────────────
echo Stopping any existing frontend on port 5173...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":5173 "') do (
    taskkill /f /t /pid %%a >nul 2>&1
)

:: Give processes a moment to release ports
timeout /t 2 /nobreak >nul

:: ── Verify Node.js ────────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please restart your computer after installing Node.js.
    pause & exit /b 1
)
for /f %%v in ('node --version') do echo Node.js %%v found.

:: ── Verify Python ─────────────────────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from python.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo %%v found.

:: ── Backend ───────────────────────────────────────────────────────────────────
echo.
echo [1/3] Setting up backend...
cd backend

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q --disable-pip-version-check

echo Starting backend on http://localhost:8000 ...
start "F1 Tracker - Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python app.py"
cd ..

:: ── Frontend ──────────────────────────────────────────────────────────────────
echo.
echo [2/3] Setting up frontend...
cd frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
    if errorlevel 1 ( echo ERROR: npm install failed. & pause & exit /b 1 )
)
echo Starting frontend on http://localhost:5173 ...
start "F1 Tracker - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
cd ..

:: ── Open browser ──────────────────────────────────────────────────────────────
echo.
echo [3/3] Waiting for servers to start...
echo.
echo  ===========================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo   API docs: http://localhost:8000/docs
echo.
echo   Data syncs every 15 minutes.
echo   First sync takes 2-4 min (rate-limited OpenF1 fetches).
echo   Use "Sync Now" in the navbar to trigger manually.
echo  ===========================
echo.
timeout /t 5 /nobreak >nul
start http://localhost:5173
