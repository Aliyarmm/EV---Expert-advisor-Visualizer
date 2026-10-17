@echo off
title EV — Expert Advisor Visualizer - Run All Tests
color 0E

echo ========================================
echo   EV — Expert Advisor Visualizer - Test Suite
echo ========================================
echo.

echo [1/3] Frontend TypeScript check...
cd /d "frontend"
npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo ❌ TypeScript errors found
    goto :error
)
echo ✅ TypeScript: OK
echo.
cd ..

echo [2/3] Frontend Jest tests...
cd /d "frontend"
npx jest --passWithNoTests
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Frontend tests failed
    goto :error
)
cd ..
echo.

echo [3/3] Backend pytest...
cd /d "backend"
python -m pytest -v
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Backend tests failed
    goto :error
)
cd ..
echo.

echo ========================================
echo   All tests passed! ✅
echo ========================================
goto :eof

:error
echo.
echo ========================================
echo   Tests failed ❌
echo ========================================
exit /b 1
