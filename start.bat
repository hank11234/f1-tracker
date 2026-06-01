@echo off
title F1 Tracker
echo.
echo  ===========================
echo   F1 TRACKER - Starting up
echo  ===========================
echo.

cd /d "%~dp0"

:: ── Refresh PATH from registry so newly installed Node.js is found ──────────
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')"`) do set "PATH=%%i"

:: ── Verify Node.js ────────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found in PATH.
    echo Please restart your computer to apply the Node.js installation, then run start.bat again.
    pause
    exit /b 1
)
for /f %%v in ('node --version') do set NODE_VER=%%v
echo Node.js %NODE_VER% found.

:: ── Verify Python ─────────────────────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.10+ from python.org
    pause
    exit /b 1
)
for /f %%v in ('python --version') do echo %%v found.

:: ── Backend ───────────────────────────────────────────────────────────────────
echo.
echo [1/3] Setting up Python backend...
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
    if errorlevel 1 (
        echo ERROR: npm install failed. Check the error above.
        pause
        exit /b 1
    )
)

echo Starting frontend on http://localhost:5173 ...
start "F1 Tracker - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
cd ..

:: ── Done ──────────────────────────────────────────────────────────────────────
echo.
echo [3/3] Opening browser...
echo.
echo  ===========================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo   API docs: http://localhost:8000/docs
echo.
echo   Data syncs every 15 minutes.
echo   Use "Sync Now" in the navbar for an immediate refresh.
echo  ===========================
echo.
timeout /t 5 /nobreak >nul
start http://localhost:5173
