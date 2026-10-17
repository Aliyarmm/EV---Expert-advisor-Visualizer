@echo off
title EA Index - Stop Servers
color 0C

echo ========================================
echo   Stopping EA Index Servers
echo ========================================
echo.

taskkill /FI "WINDOWTITLE" eq "EA Index Backend" /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Stopped backend server
) else (
    echo Backend was not running
)

taskkill /FI "WINDOWTITLE" eq "EA Index Frontend" /F 2>nul
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
