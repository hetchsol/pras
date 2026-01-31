@echo off
REM Purchase Requisition System - Service Restart Script
REM This script restarts both services (useful after updates)

echo ========================================
echo Purchase Requisition System
echo Service Restart Script
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
    echo Cannot restart services without NSSM
    echo.
    pause
    exit /b 1
)

echo Restarting services...
echo.

echo [1/2] Restarting Backend service...
sc query PurchaseRequisition-Backend >nul 2>&1
if %errorlevel% equ 0 (
    C:\nssm\nssm.exe restart PurchaseRequisition-Backend
    timeout /t 2 /nobreak >nul
    echo       [OK] Backend service restarted
) else (
    echo       [ERROR] Backend service not found
)
echo.

echo [2/2] Restarting Nginx service...
sc query PurchaseRequisition-Nginx >nul 2>&1
if %errorlevel% equ 0 (
    C:\nssm\nssm.exe restart PurchaseRequisition-Nginx
    timeout /t 2 /nobreak >nul
    echo       [OK] Nginx service restarted
) else (
    echo       [ERROR] Nginx service not found
)
echo.

echo ========================================
echo Services Restarted
echo ========================================
echo.
echo Waiting for services to stabilize...
timeout /t 5 /nobreak >nul
echo.
echo Application should now be accessible at:
echo   - http://localhost
echo   - http://%COMPUTERNAME%
echo.
pause
