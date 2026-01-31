@echo off
REM Purchase Requisition System - Database Restore Script
REM This script restores database from a backup

setlocal enabledelayedexpansion

echo ========================================
echo Purchase Requisition System
echo Database Restore Script
echo ========================================
echo.

REM Check for Administrator privileges (to stop services if needed)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Not running as Administrator
    echo If services are running, you'll need to stop them manually first
    echo.
)

REM Set paths
set DB_PATH=C:\Projects\purchase-requisition-system\backend\purchase_requisition.db
set BACKUP_DIR=C:\Projects\purchase-requisition-system\backups
set LOG_DIR=C:\Projects\purchase-requisition-system\logs
set LOG_FILE=%LOG_DIR%\restore_log.txt

REM Check if backup directory exists
if not exist "%BACKUP_DIR%" (
    echo ERROR: Backup directory not found at %BACKUP_DIR%
    echo Please create backups first using backup-database.bat
    pause
    exit /b 1
)

REM List available backups
echo Available Backups:
echo ========================================
set COUNT=0
for /f "delims=" %%f in ('dir /b /o-d "%BACKUP_DIR%\purchase_requisition_backup_*" 2^>nul') do (
    set /a COUNT+=1
    set "BACKUP_!COUNT!=%%f"
    echo !COUNT!. %%f
)

if %COUNT% equ 0 (
    echo No backups found in %BACKUP_DIR%
    pause
    exit /b 1
)
echo.

REM Prompt user to select backup
set /p SELECTION="Enter backup number to restore (1-%COUNT%) or 0 to cancel: "

if "%SELECTION%"=="0" (
    echo Restore cancelled.
    pause
    exit /b 0
)

REM Validate selection
if %SELECTION% lss 1 (
    echo Invalid selection
    pause
    exit /b 1
)
if %SELECTION% gtr %COUNT% (
    echo Invalid selection
    pause
    exit /b 1
)

REM Get selected backup file
set SELECTED_BACKUP=!BACKUP_%SELECTION%!
set RESTORE_FILE=%BACKUP_DIR%\%SELECTED_BACKUP%

echo.
echo Selected Backup: %SELECTED_BACKUP%
echo.

REM Check if it's a zip file
echo %RESTORE_FILE% | findstr /i ".zip$" >nul
if %errorlevel% equ 0 (
    REM Extract if it's zipped
    where 7z >nul 2>&1
    if %errorlevel% equ 0 (
        echo Extracting compressed backup...
        7z e "%RESTORE_FILE%" -o"%BACKUP_DIR%" -y >nul
        set RESTORE_FILE=%RESTORE_FILE:.zip=.db%
        echo [OK] Backup extracted
        echo.
    ) else (
        echo ERROR: Backup is compressed but 7-Zip not found
        echo Please install 7-Zip or manually extract the backup
        pause
        exit /b 1
    )
)

REM Final confirmation
echo WARNING: This will replace your current database!
echo.
echo Current database: %DB_PATH%
echo Will be replaced with: %RESTORE_FILE%
echo.
set /p FINAL_CONFIRM="Type YES to confirm restore: "

if /i not "%FINAL_CONFIRM%"=="YES" (
    echo Restore cancelled.
    pause
    exit /b 0
)
echo.

REM Check if services are running and stop them
set SERVICES_WERE_RUNNING=0

if exist "C:\nssm\nssm.exe" (
    echo Checking if services are running...

    sc query PurchaseRequisition-Backend | findstr "RUNNING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo Stopping Backend service...
        C:\nssm\nssm.exe stop PurchaseRequisition-Backend
        set SERVICES_WERE_RUNNING=1
        timeout /t 3 /nobreak >nul
    )

    sc query PurchaseRequisition-Nginx | findstr "RUNNING" >nul 2>&1
    if %errorlevel% equ 0 (
        echo Stopping Nginx service...
        C:\nssm\nssm.exe stop PurchaseRequisition-Nginx
        timeout /t 2 /nobreak >nul
    )
    echo.
)

REM Create backup of current database before restore
if exist "%DB_PATH%" (
    echo Creating backup of current database before restore...
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
    set TIMESTAMP=!datetime:~0,8!_!datetime:~8,6!
    set PRE_RESTORE_BACKUP=%BACKUP_DIR%\pre_restore_backup_%TIMESTAMP%.db
    copy "%DB_PATH%" "!PRE_RESTORE_BACKUP!" >nul
    echo [OK] Current database backed up to: !PRE_RESTORE_BACKUP!
    echo.
)

REM Perform restore
echo Restoring database...
copy /y "%RESTORE_FILE%" "%DB_PATH%" >nul

if %errorlevel% equ 0 (
    echo [OK] Database restored successfully
    echo [%date% %time%] SUCCESS: Database restored from %RESTORE_FILE% >> "%LOG_FILE%"
) else (
    echo [ERROR] Database restore failed
    echo [%date% %time%] ERROR: Database restore failed >> "%LOG_FILE%"
    if exist "!PRE_RESTORE_BACKUP!" (
        echo Attempting to restore previous database...
        copy /y "!PRE_RESTORE_BACKUP!" "%DB_PATH%" >nul
        echo [WARNING] Restored previous database state
    )
    pause
    exit /b 1
)
echo.

REM Restart services if they were running
if %SERVICES_WERE_RUNNING% equ 1 (
    if exist "C:\nssm\nssm.exe" (
        echo Restarting services...
        C:\nssm\nssm.exe start PurchaseRequisition-Nginx
        timeout /t 2 /nobreak >nul
        C:\nssm\nssm.exe start PurchaseRequisition-Backend
        echo [OK] Services restarted
        echo.
    )
)

echo ========================================
echo Restore Complete
echo ========================================
echo.
echo Database has been restored from: %SELECTED_BACKUP%
echo.
echo Pre-restore backup saved to: !PRE_RESTORE_BACKUP!
echo.
echo Your application should now be running with the restored data.
echo Access at: http://localhost
echo.
pause
