@echo off
title EV — Expert Advisor Visualizer - Stop Servers
color 0C

echo ========================================
echo   Stopping EV — Expert Advisor Visualizer Servers
echo ========================================
echo.

taskkill /FI "WINDOWTITLE" eq "EV — Expert Advisor Visualizer Backend" /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Stopped backend server
) else (
    echo Backend was not running
)

taskkill /FI "WINDOWTITLE" eq "EV — Expert Advisor Visualizer Frontend" /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Stopped frontend server
) else (
    echo Frontend was not running
)

pkill -f "uvicorn.*app.main:app" 2>nul
pkill -f "next dev" 2>nul

echo.
echo Servers stopped.
timeout /t 2 /nobreak >nul
