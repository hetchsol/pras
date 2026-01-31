@echo off
REM Purchase Requisition System - Database Backup Script
REM This script creates timestamped backups of the SQLite database

setlocal enabledelayedexpansion

echo ========================================
echo Purchase Requisition System
echo Database Backup Script
echo ========================================
echo.

REM Set paths
set DB_PATH=C:\Projects\purchase-requisition-system\backend\purchase_requisition.db
set BACKUP_DIR=C:\Projects\purchase-requisition-system\backups
set LOG_DIR=C:\Projects\purchase-requisition-system\logs

REM Create backup and log directories if they don't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Generate timestamp (format: YYYYMMDD_HHMMSS)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

REM Set backup file name
set BACKUP_FILE=%BACKUP_DIR%\purchase_requisition_backup_%TIMESTAMP%.db
set LOG_FILE=%LOG_DIR%\backup_log.txt

echo Backup Details:
echo ----------------------------------------
echo Source Database: %DB_PATH%
echo Backup Location: %BACKUP_FILE%
echo Timestamp: %TIMESTAMP%
echo.

REM Check if source database exists
if not exist "%DB_PATH%" (
    echo ERROR: Source database not found at %DB_PATH%
    echo [%date% %time%] ERROR: Database not found >> "%LOG_FILE%"
    pause
    exit /b 1
)

REM Get database file size
for %%A in ("%DB_PATH%") do set DB_SIZE=%%~zA

REM Create backup
echo Creating backup...
copy "%DB_PATH%" "%BACKUP_FILE%" >nul

if %errorlevel% equ 0 (
    echo [OK] Backup created successfully
    echo       Size: %DB_SIZE% bytes
    echo.
    echo [%date% %time%] SUCCESS: Backup created - %BACKUP_FILE% >> "%LOG_FILE%"
) else (
    echo [ERROR] Backup failed
    echo [%date% %time%] ERROR: Backup failed >> "%LOG_FILE%"
    pause
    exit /b 1
)

REM Optional: Compress backup using 7-Zip (if installed)
where 7z >nul 2>&1
if %errorlevel% equ 0 (
    echo Compressing backup...
    7z a -tzip "%BACKUP_FILE%.zip" "%BACKUP_FILE%" >nul
    if %errorlevel% equ 0 (
        echo [OK] Backup compressed
        del "%BACKUP_FILE%"
        set BACKUP_FILE=%BACKUP_FILE%.zip
        echo [%date% %time%] INFO: Backup compressed >> "%LOG_FILE%"
    )
    echo.
)

REM Calculate backup retention (keep last 30 backups)
echo Cleaning old backups (keeping last 30)...
set COUNT=0
for /f "delims=" %%f in ('dir /b /o-d "%BACKUP_DIR%\purchase_requisition_backup_*.db" "%BACKUP_DIR%\purchase_requisition_backup_*.zip" 2^>nul') do (
    set /a COUNT+=1
    if !COUNT! gtr 30 (
        del "%BACKUP_DIR%\%%f" >nul 2>&1
        echo       Deleted old backup: %%f
        echo [%date% %time%] INFO: Deleted old backup - %%f >> "%LOG_FILE%"
    )
)
echo [OK] Cleanup complete
echo.

REM Display backup summary
echo ========================================
echo Backup Summary
echo ========================================
echo.
echo Latest Backup: %BACKUP_FILE%
echo.
echo Recent Backups:
dir /b /o-d "%BACKUP_DIR%\purchase_requisition_backup_*" 2>nul | findstr /n "^" | findstr "^[1-5]:"
echo.
echo Total Backups:
dir /b "%BACKUP_DIR%\purchase_requisition_backup_*" 2>nul | find /c /v ""
echo.
echo Backup completed successfully!
echo.

REM Optional: Don't pause if running from scheduled task
if "%1"=="auto" (
    exit /b 0
) else (
    pause
)
