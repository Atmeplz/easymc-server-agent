@echo off
REM AI maintenance note: Keep all code comments in English.
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title EasyMC Server Agent

echo.
echo ============================================================
echo   EasyMC Server Agent
echo ============================================================
echo.
echo This window is the EasyMC server console.
echo Close this window to stop localhost:3000.
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found.
    echo Please install Node.js 18 or newer from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

node start.js
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
    echo.
    echo EasyMC Server Agent exited with code %EXIT_CODE%.
    echo Check the messages above for details.
    echo.
    pause
)

exit /b %EXIT_CODE%
