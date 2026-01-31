@echo off
REM Purchase Requisition System - Service Installation Script
REM This script installs Nginx and Node.js as Windows services using NSSM
REM
REM REQUIREMENTS:
REM - Run as Administrator
REM - NSSM installed at C:\nssm\nssm.exe
REM - Nginx installed at C:\nginx
REM - Node.js installed

echo ========================================
echo Purchase Requisition System
echo Service Installation Script
echo ========================================
echo.

REM Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script requires Administrator privileges
    echo Please right-click and select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

REM Check if NSSM is installed
if not exist "C:\nssm\nssm.exe" (
    echo ERROR: NSSM not found at C:\nssm\nssm.exe
    echo.
    echo Please download NSSM from https://nssm.cc/download
    echo Extract it and copy nssm.exe to C:\nssm\
    echo.
    pause
    exit /b 1
)

REM Check if Nginx is installed
if not exist "C:\nginx\nginx.exe" (
    echo ERROR: Nginx not found at C:\nginx\nginx.exe
    echo Please install Nginx first. See NGINX_SETUP_GUIDE.md
    echo.
    pause
    exit /b 1
)

REM Find Node.js installation
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found in PATH
    echo Please install Node.js or add it to your PATH
    echo.
    pause
    exit /b 1
)

REM Get Node.js path
for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i
echo Found Node.js at: %NODE_PATH%
echo.

REM Create logs directory
if not exist "C:\Projects\purchase-requisition-system\backend\logs" (
    mkdir "C:\Projects\purchase-requisition-system\backend\logs"
)

echo ========================================
echo Installing Nginx Service
echo ========================================
echo.

REM Check if Nginx service already exists
sc query PurchaseRequisition-Nginx >nul 2>&1
if %errorlevel% equ 0 (
    echo Nginx service already exists. Removing old service...
    C:\nssm\nssm.exe stop PurchaseRequisition-Nginx
    C:\nssm\nssm.exe remove PurchaseRequisition-Nginx confirm
    timeout /t 2 /nobreak >nul
)

REM Install Nginx service
echo Installing Nginx service...
C:\nssm\nssm.exe install PurchaseRequisition-Nginx C:\nginx\nginx.exe
C:\nssm\nssm.exe set PurchaseRequisition-Nginx Start SERVICE_AUTO_START
C:\nssm\nssm.exe set PurchaseRequisition-Nginx Description "Nginx web server for Purchase Requisition System (Port 80)"
C:\nssm\nssm.exe set PurchaseRequisition-Nginx DisplayName "Purchase Requisition - Nginx"
C:\nssm\nssm.exe set PurchaseRequisition-Nginx AppDirectory C:\nginx
C:\nssm\nssm.exe set PurchaseRequisition-Nginx AppExit Default Restart
C:\nssm\nssm.exe set PurchaseRequisition-Nginx AppRestartDelay 5000
C:\nssm\nssm.exe set PurchaseRequisition-Nginx AppStdout C:\nginx\logs\service-stdout.log
C:\nssm\nssm.exe set PurchaseRequisition-Nginx AppStderr C:\nginx\logs\service-stderr.log

echo [OK] Nginx service installed
echo.

echo ========================================
echo Installing Node.js Backend Service
echo ========================================
echo.

REM Check if Backend service already exists
sc query PurchaseRequisition-Backend >nul 2>&1
if %errorlevel% equ 0 (
    echo Backend service already exists. Removing old service...
    C:\nssm\nssm.exe stop PurchaseRequisition-Backend
    C:\nssm\nssm.exe remove PurchaseRequisition-Backend confirm
    timeout /t 2 /nobreak >nul
)

REM Install Backend service
echo Installing Node.js Backend service...
C:\nssm\nssm.exe install PurchaseRequisition-Backend "%NODE_PATH%" server.js
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppDirectory C:\Projects\purchase-requisition-system\backend
C:\nssm\nssm.exe set PurchaseRequisition-Backend Start SERVICE_AUTO_START
C:\nssm\nssm.exe set PurchaseRequisition-Backend DependOnService PurchaseRequisition-Nginx
C:\nssm\nssm.exe set PurchaseRequisition-Backend Description "Node.js backend for Purchase Requisition System (Port 3001)"
C:\nssm\nssm.exe set PurchaseRequisition-Backend DisplayName "Purchase Requisition - Backend"
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppEnvironmentExtra NODE_ENV=production
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppExit Default Restart
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppRestartDelay 5000
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppStdout C:\Projects\purchase-requisition-system\backend\logs\service-stdout.log
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppStderr C:\Projects\purchase-requisition-system\backend\logs\service-stderr.log
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppRotateFiles 1
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppRotateOnline 1
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppRotateSeconds 86400
C:\nssm\nssm.exe set PurchaseRequisition-Backend AppRotateBytes 1048576

echo [OK] Backend service installed
echo.

echo ========================================
echo Starting Services
echo ========================================
echo.

echo Starting Nginx service...
C:\nssm\nssm.exe start PurchaseRequisition-Nginx
timeout /t 3 /nobreak >nul

C:\nssm\nssm.exe status PurchaseRequisition-Nginx
if %errorlevel% equ 0 (
    echo [OK] Nginx service started
) else (
    echo [WARNING] Nginx service may not have started correctly
    echo Check logs at C:\nginx\logs\
)
echo.

echo Starting Backend service...
C:\nssm\nssm.exe start PurchaseRequisition-Backend
timeout /t 3 /nobreak >nul

C:\nssm\nssm.exe status PurchaseRequisition-Backend
if %errorlevel% equ 0 (
    echo [OK] Backend service started
) else (
    echo [WARNING] Backend service may not have started correctly
    echo Check logs at C:\Projects\purchase-requisition-system\backend\logs\
)
echo.

echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Services installed:
echo   1. Purchase Requisition - Nginx (Port 80)
echo   2. Purchase Requisition - Backend (Port 3001)
echo.
echo Both services are set to start automatically on boot.
echo.
echo Access your application at:
echo   - http://localhost
echo   - http://%COMPUTERNAME%
echo.
echo To manage services:
echo   - Press Win + R, type: services.msc
echo   - Or use: nssm start/stop/restart ServiceName
echo.
echo Logs location:
echo   - Nginx: C:\nginx\logs\
echo   - Backend: C:\Projects\purchase-requisition-system\backend\logs\
echo.
echo To uninstall, run: uninstall-services.bat
echo.
pause
