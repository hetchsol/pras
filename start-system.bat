@echo off
REM Purchase Requisition System Startup Script
REM This script starts Nginx (port 80) and Node.js backend (port 3001)

echo ========================================
echo Purchase Requisition System
echo Starting Services...
echo ========================================
echo.

REM Check if Nginx is installed
if not exist "C:\nginx\nginx.exe" (
    echo ERROR: Nginx not found at C:\nginx\nginx.exe
    echo Please install Nginx first. See NGINX_SETUP_GUIDE.md
    echo.
    pause
    exit /b 1
)

REM Start Nginx
echo [1/2] Starting Nginx on port 80...
cd /d C:\nginx
start /min nginx.exe
timeout /t 2 /nobreak > nul

REM Check if Nginx started successfully
tasklist /fi "imagename eq nginx.exe" 2>nul | find /i "nginx.exe" > nul
if %errorlevel% equ 0 (
    echo       [OK] Nginx started successfully
) else (
    echo       [FAILED] Nginx failed to start
    echo       Check C:\nginx\logs\error.log for details
)
echo.

REM Start Node.js Backend
echo [2/2] Starting Node.js backend on port 3001...
cd /d "%~dp0backend"
start "Purchase Requisition Backend" cmd /k "npm start"
echo       [OK] Backend starting...
echo.

echo ========================================
echo Services Started!
echo ========================================
echo.
echo Access your application at:
echo   - http://localhost
echo   - http://ZMKTCMW002
echo   - http://192.168.5.249
echo.
echo Press any key to exit this window...
pause > nul
