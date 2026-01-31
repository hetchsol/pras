@echo off
REM Purchase Requisition System Stop Script
REM This script stops Nginx and Node.js backend

echo ========================================
echo Purchase Requisition System
echo Stopping Services...
echo ========================================
echo.

REM Stop Nginx
echo [1/2] Stopping Nginx...
cd /d C:\nginx
nginx.exe -s stop 2>nul
timeout /t 2 /nobreak > nul

REM Verify Nginx stopped
tasklist /fi "imagename eq nginx.exe" 2>nul | find /i "nginx.exe" > nul
if %errorlevel% equ 0 (
    echo       [WARNING] Nginx still running, forcing stop...
    taskkill /f /im nginx.exe > nul 2>&1
) else (
    echo       [OK] Nginx stopped
)
echo.

REM Stop Node.js processes
echo [2/2] Stopping Node.js backend...
tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" > nul
if %errorlevel% equ 0 (
    REM Find and kill only our backend process
    for /f "tokens=2" %%i in ('netstat -ano ^| findstr :3001') do (
        taskkill /PID %%i /F > nul 2>&1
    )
    echo       [OK] Backend stopped
) else (
    echo       [OK] Backend not running
)
echo.

echo ========================================
echo All Services Stopped
echo ========================================
echo.
pause
