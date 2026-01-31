@echo off
REM Purchase Requisition System - Service Status Check
REM This script checks the status of the services and attempts to restart if needed

echo ========================================
echo Purchase Requisition System
echo Service Status Check
echo ========================================
echo.

REM Check if NSSM is installed
if not exist "C:\nssm\nssm.exe" (
    echo ERROR: NSSM not found at C:\nssm\nssm.exe
    echo Services cannot be managed without NSSM
    echo.
    pause
    exit /b 1
)

echo Checking Nginx Service...
echo ----------------------------------------

sc query PurchaseRequisition-Nginx >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Nginx service not installed
    echo Run install-services.bat to install
) else (
    C:\nssm\nssm.exe status PurchaseRequisition-Nginx >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Nginx service is running
    ) else (
        echo [WARNING] Nginx service is not running
        echo Attempting to start...
        C:\nssm\nssm.exe start PurchaseRequisition-Nginx
        timeout /t 2 /nobreak >nul
        C:\nssm\nssm.exe status PurchaseRequisition-Nginx >nul 2>&1
        if %errorlevel% equ 0 (
            echo [OK] Nginx service started successfully
        ) else (
            echo [ERROR] Failed to start Nginx service
            echo Check logs at: C:\nginx\logs\service-stderr.log
        )
    )
)
echo.

echo Checking Backend Service...
echo ----------------------------------------

sc query PurchaseRequisition-Backend >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Backend service not installed
    echo Run install-services.bat to install
) else (
    C:\nssm\nssm.exe status PurchaseRequisition-Backend >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Backend service is running
    ) else (
        echo [WARNING] Backend service is not running
        echo Attempting to start...
        C:\nssm\nssm.exe start PurchaseRequisition-Backend
        timeout /t 2 /nobreak >nul
        C:\nssm\nssm.exe status PurchaseRequisition-Backend >nul 2>&1
        if %errorlevel% equ 0 (
            echo [OK] Backend service started successfully
        ) else (
            echo [ERROR] Failed to start Backend service
            echo Check logs at: C:\Projects\purchase-requisition-system\backend\logs\service-stderr.log
        )
    )
)
echo.

echo Checking Application Access...
echo ----------------------------------------

REM Try to access the application
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Application is accessible at http://localhost
) else (
    echo [WARNING] Could not verify application access
    echo Try accessing: http://localhost in your browser
)
echo.

echo ========================================
echo Status Check Complete
echo ========================================
echo.
echo Access your application at:
echo   - http://localhost
echo   - http://%COMPUTERNAME%
echo.
echo To view detailed service info:
echo   Press Win + R, type: services.msc
echo.
pause
