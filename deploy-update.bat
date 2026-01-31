@echo off
REM Purchase Requisition System - Deployment & Update Script
REM This script safely deploys updates with automatic backup and service management

setlocal enabledelayedexpansion

echo ========================================
echo Purchase Requisition System
echo Deployment ^& Update Script
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

REM Set paths
set PROJECT_ROOT=C:\Projects\purchase-requisition-system
set BACKEND_PATH=%PROJECT_ROOT%\backend
set FRONTEND_PATH=%PROJECT_ROOT%\frontend
set BACKUP_DIR=%PROJECT_ROOT%\backups
set LOG_DIR=%PROJECT_ROOT%\logs
set DEPLOY_LOG=%LOG_DIR%\deployment_log.txt

REM Create directories if they don't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

echo Deployment Configuration:
echo ----------------------------------------
echo Project Root: %PROJECT_ROOT%
echo Backend Path: %BACKEND_PATH%
echo Frontend Path: %FRONTEND_PATH%
echo Timestamp: %TIMESTAMP%
echo.

REM Log deployment start
echo [%date% %time%] ========== DEPLOYMENT STARTED ========== >> "%DEPLOY_LOG%"

REM ========================================
REM STEP 1: Pre-Deployment Checks
REM ========================================
echo ========================================
echo STEP 1: Pre-Deployment Checks
echo ========================================
echo.

echo [1/4] Checking NSSM installation...
if exist "C:\nssm\nssm.exe" (
    echo       [OK] NSSM found
    set USE_SERVICES=1
) else (
    echo       [WARNING] NSSM not found - services won't be managed
    set USE_SERVICES=0
)

echo [2/4] Checking Nginx installation...
if exist "C:\nginx\nginx.exe" (
    echo       [OK] Nginx found
) else (
    echo       [WARNING] Nginx not found at C:\nginx
)

echo [3/4] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo       [OK] Node.js found - !NODE_VERSION!
) else (
    echo       [ERROR] Node.js not found
    echo       Please install Node.js first
    pause
    exit /b 1
)

echo [4/4] Checking backend dependencies...
if exist "%BACKEND_PATH%\node_modules" (
    echo       [OK] Node modules found
) else (
    echo       [WARNING] Node modules not found - will install
)

echo.
echo [%date% %time%] Pre-deployment checks completed >> "%DEPLOY_LOG%"

REM ========================================
REM STEP 2: Backup Current State
REM ========================================
echo ========================================
echo STEP 2: Creating Pre-Deployment Backup
echo ========================================
echo.

echo [1/2] Backing up database...
if exist "%BACKEND_PATH%\purchase_requisition.db" (
    set DB_BACKUP=%BACKUP_DIR%\pre_deploy_db_%TIMESTAMP%.db
    copy "%BACKEND_PATH%\purchase_requisition.db" "!DB_BACKUP!" >nul
    if !errorlevel! equ 0 (
        echo       [OK] Database backed up
        echo [%date% %time%] Database backed up to !DB_BACKUP! >> "%DEPLOY_LOG%"
    ) else (
        echo       [ERROR] Database backup failed
        pause
        exit /b 1
    )
) else (
    echo       [INFO] No database found to backup
)

echo [2/2] Backing up .env configuration...
if exist "%BACKEND_PATH%\.env" (
    set ENV_BACKUP=%BACKUP_DIR%\env_backup_%TIMESTAMP%.txt
    copy "%BACKEND_PATH%\.env" "!ENV_BACKUP!" >nul
    echo       [OK] .env configuration backed up
    echo [%date% %time%] .env backed up to !ENV_BACKUP! >> "%DEPLOY_LOG%"
) else (
    echo       [WARNING] No .env file found
)

echo.

REM ========================================
REM STEP 3: Stop Services
REM ========================================
echo ========================================
echo STEP 3: Stopping Services
echo ========================================
echo.

if %USE_SERVICES% equ 1 (
    echo [1/2] Stopping Backend service...
    sc query PurchaseRequisition-Backend | findstr "RUNNING" >nul 2>&1
    if !errorlevel! equ 0 (
        C:\nssm\nssm.exe stop PurchaseRequisition-Backend
        timeout /t 3 /nobreak >nul
        echo       [OK] Backend service stopped
        echo [%date% %time%] Backend service stopped >> "%DEPLOY_LOG%"
    ) else (
        echo       [INFO] Backend service not running
    )

    echo [2/2] Stopping Nginx service...
    sc query PurchaseRequisition-Nginx | findstr "RUNNING" >nul 2>&1
    if !errorlevel! equ 0 (
        C:\nssm\nssm.exe stop PurchaseRequisition-Nginx
        timeout /t 2 /nobreak >nul
        echo       [OK] Nginx service stopped
        echo [%date% %time%] Nginx service stopped >> "%DEPLOY_LOG%"
    ) else (
        echo       [INFO] Nginx service not running
    )
) else (
    echo Services not configured - skipping
)

echo.

REM ========================================
REM STEP 4: Install/Update Dependencies
REM ========================================
echo ========================================
echo STEP 4: Installing Dependencies
echo ========================================
echo.

echo Installing backend dependencies...
cd /d "%BACKEND_PATH%"
call npm install --production

if %errorlevel% equ 0 (
    echo [OK] Dependencies installed successfully
    echo [%date% %time%] Backend dependencies installed >> "%DEPLOY_LOG%"
) else (
    echo [ERROR] Failed to install dependencies
    echo [%date% %time%] ERROR: npm install failed >> "%DEPLOY_LOG%"
    echo.
    echo Attempting to restore from backup...
    goto ROLLBACK
)

echo.

REM ========================================
REM STEP 5: Database Migration (if needed)
REM ========================================
echo ========================================
echo STEP 5: Database Migration
echo ========================================
echo.

REM Check for migration scripts
if exist "%BACKEND_PATH%\scripts\migrate.js" (
    echo Running database migrations...
    node "%BACKEND_PATH%\scripts\migrate.js"
    if !errorlevel! equ 0 (
        echo [OK] Migrations completed
        echo [%date% %time%] Database migrations completed >> "%DEPLOY_LOG%"
    ) else (
        echo [WARNING] Migrations failed or not needed
    )
) else (
    echo [INFO] No migration script found - skipping
)

echo.

REM ========================================
REM STEP 6: Update Configuration
REM ========================================
echo ========================================
echo STEP 6: Configuration Update
echo ========================================
echo.

echo Checking .env file...
if exist "%BACKEND_PATH%\.env" (
    echo [OK] .env file exists
) else (
    echo [WARNING] .env file not found
    if exist "%BACKEND_PATH%\.env.example" (
        echo Creating .env from .env.example...
        copy "%BACKEND_PATH%\.env.example" "%BACKEND_PATH%\.env"
        echo [WARNING] Please update .env with your settings
    )
)

echo.

REM ========================================
REM STEP 7: Restart Services
REM ========================================
echo ========================================
echo STEP 7: Starting Services
echo ========================================
echo.

if %USE_SERVICES% equ 1 (
    echo [1/2] Starting Nginx service...
    C:\nssm\nssm.exe start PurchaseRequisition-Nginx
    timeout /t 2 /nobreak >nul

    sc query PurchaseRequisition-Nginx | findstr "RUNNING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       [OK] Nginx service started
        echo [%date% %time%] Nginx service started >> "%DEPLOY_LOG%"
    ) else (
        echo       [ERROR] Nginx service failed to start
        echo [%date% %time%] ERROR: Nginx service start failed >> "%DEPLOY_LOG%"
    )

    echo [2/2] Starting Backend service...
    C:\nssm\nssm.exe start PurchaseRequisition-Backend
    timeout /t 3 /nobreak >nul

    sc query PurchaseRequisition-Backend | findstr "RUNNING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       [OK] Backend service started
        echo [%date% %time%] Backend service started >> "%DEPLOY_LOG%"
    ) else (
        echo       [ERROR] Backend service failed to start
        echo [%date% %time%] ERROR: Backend service start failed >> "%DEPLOY_LOG%"
        echo.
        echo Checking service logs...
        if exist "%BACKEND_PATH%\logs\service-stderr.log" (
            echo Recent errors:
            powershell -command "Get-Content '%BACKEND_PATH%\logs\service-stderr.log' -Tail 10"
        )
        goto ROLLBACK
    )
) else (
    echo Services not configured
    echo Please start the application manually:
    echo   cd %BACKEND_PATH%
    echo   npm start
)

echo.

REM ========================================
REM STEP 8: Health Check
REM ========================================
echo ========================================
echo STEP 8: Health Check
echo ========================================
echo.

echo Waiting for application to start...
timeout /t 5 /nobreak >nul

echo Testing application accessibility...
curl -s -o nul -w "HTTP Status: %%{http_code}" http://localhost >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Application is accessible
    echo [%date% %time%] Health check passed >> "%DEPLOY_LOG%"
) else (
    echo [WARNING] Could not verify application access
    echo Please check manually: http://localhost
    echo [%date% %time%] Health check: Could not verify >> "%DEPLOY_LOG%"
)

echo.

REM ========================================
REM STEP 9: Deployment Summary
REM ========================================
echo ========================================
echo DEPLOYMENT COMPLETE
echo ========================================
echo.
echo Deployment Time: %TIMESTAMP%
echo.
echo Backups Created:
if defined DB_BACKUP echo   - Database: !DB_BACKUP!
if defined ENV_BACKUP echo   - Configuration: !ENV_BACKUP!
echo.
echo Application Status:
if %USE_SERVICES% equ 1 (
    C:\nssm\nssm.exe status PurchaseRequisition-Nginx 2>nul
    C:\nssm\nssm.exe status PurchaseRequisition-Backend 2>nul
)
echo.
echo Access your application at:
echo   - http://localhost
echo   - http://%COMPUTERNAME%
echo.
echo Deployment log: %DEPLOY_LOG%
echo.
echo [%date% %time%] ========== DEPLOYMENT COMPLETED SUCCESSFULLY ========== >> "%DEPLOY_LOG%"
echo.
pause
exit /b 0

REM ========================================
REM ROLLBACK PROCEDURE
REM ========================================
:ROLLBACK
echo.
echo ========================================
echo ROLLBACK PROCEDURE
echo ========================================
echo.
echo An error occurred during deployment.
echo.
set /p ROLLBACK_CONFIRM="Do you want to rollback to previous state? (Y/N): "

if /i not "%ROLLBACK_CONFIRM%"=="Y" (
    echo Rollback cancelled.
    echo Please investigate the error manually.
    echo [%date% %time%] ERROR: Deployment failed - rollback declined >> "%DEPLOY_LOG%"
    pause
    exit /b 1
)

echo.
echo Performing rollback...

if defined DB_BACKUP (
    echo Restoring database...
    copy /y "!DB_BACKUP!" "%BACKEND_PATH%\purchase_requisition.db" >nul
    echo [OK] Database restored
)

if defined ENV_BACKUP (
    echo Restoring configuration...
    copy /y "!ENV_BACKUP!" "%BACKEND_PATH%\.env" >nul
    echo [OK] Configuration restored
)

if %USE_SERVICES% equ 1 (
    echo Restarting services...
    C:\nssm\nssm.exe start PurchaseRequisition-Nginx >nul 2>&1
    timeout /t 2 /nobreak >nul
    C:\nssm\nssm.exe start PurchaseRequisition-Backend >nul 2>&1
    echo [OK] Services restarted
)

echo.
echo [%date% %time%] ERROR: Deployment failed - rollback completed >> "%DEPLOY_LOG%"
echo Rollback completed. System restored to previous state.
echo.
pause
exit /b 1
