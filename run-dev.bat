@echo off
title EV — Expert Advisor Visualizer - Start Both Servers
color 0A

echo ========================================
echo   EV — Expert Advisor Visualizer Trading Platform - Dev Mode
echo ========================================
echo.

REM Use the directory where this .bat lives as the project root
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

REM Start backend in background
echo [1/2] Starting backend (FastAPI on port 8000)...
start "EV — Expert Advisor Visualizer Backend" cmd /c "cd /d "%PROJECT_ROOT%\backend" && python -m uvicorn app.main:app --reload --port 8000"

REM Wait for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend in background
echo [2/2] Starting frontend (Next.js on port 3003)...
start "EV — Expert Advisor Visualizer Frontend" cmd /c "cd /d "%PROJECT_ROOT%\frontend" && npm run dev"

echo.
echo Both servers starting...
echo   Backend:  http://127.0.0.1:8000
echo   Frontend: http://localhost:3003
echo.
echo Waiting for frontend to be ready...
:waitloop
timeout /t 2 /nobreak >nul
curl -s http://localhost:3003 >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto waitloop

echo.
echo Frontend is ready! Opening browser...
echo.
start "" "http://localhost:3003"

echo Press any key to close this window. Servers will keep running in their tabs.
pause >nul
