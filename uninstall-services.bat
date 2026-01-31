@echo off
REM Purchase Requisition System - Service Uninstallation Script
REM This script removes the Windows services

echo ========================================
echo Purchase Requisition System
echo Service Uninstallation Script
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
    echo Cannot uninstall services without NSSM
    echo.
    pause
    exit /b 1
)

echo WARNING: This will remove the Purchase Requisition services
echo.
set /p CONFIRM="Are you sure you want to continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Uninstallation cancelled.
    pause
    exit /b 0
)
echo.

echo ========================================
echo Stopping Services
echo ========================================
echo.

REM Stop Backend service
sc query PurchaseRequisition-Backend >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping Backend service...
    C:\nssm\nssm.exe stop PurchaseRequisition-Backend
    timeout /t 2 /nobreak >nul
    echo [OK] Backend service stopped
) else (
    echo Backend service not found (may already be removed)
)
echo.

REM Stop Nginx service
sc query PurchaseRequisition-Nginx >nul 2>&1
if %errorlevel% equ 0 (
    echo Stopping Nginx service...
    C:\nssm\nssm.exe stop PurchaseRequisition-Nginx
    timeout /t 2 /nobreak >nul
    echo [OK] Nginx service stopped
) else (
    echo Nginx service not found (may already be removed)
)
echo.

echo ========================================
echo Removing Services
echo ========================================
echo.

REM Remove Backend service
sc query PurchaseRequisition-Backend >nul 2>&1
if %errorlevel% equ 0 (
    echo Removing Backend service...
    C:\nssm\nssm.exe remove PurchaseRequisition-Backend confirm
    echo [OK] Backend service removed
) else (
    echo Backend service already removed
)
echo.

REM Remove Nginx service
sc query PurchaseRequisition-Nginx >nul 2>&1
if %errorlevel% equ 0 (
    echo Removing Nginx service...
    C:\nssm\nssm.exe remove PurchaseRequisition-Nginx confirm
    echo [OK] Nginx service removed
) else (
    echo Nginx service already removed
)
echo.

echo ========================================
echo Uninstallation Complete
echo ========================================
echo.
echo All services have been removed.
echo.
echo Note: This does not uninstall:
echo   - NSSM (C:\nssm\)
echo   - Nginx (C:\nginx\)
echo   - Node.js
echo   - Your application files
echo.
echo To reinstall services, run: install-services.bat
echo.
pause
