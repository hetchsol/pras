@echo off
REM Purchase Requisition System - Backup Scheduler
REM This script sets up automatic database backups using Windows Task Scheduler

echo ========================================
echo Purchase Requisition System
echo Backup Scheduler Setup
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

echo This will create scheduled tasks for automatic database backups:
echo.
echo   1. Daily backup at 2:00 AM
echo   2. Weekly backup on Sunday at 3:00 AM
echo   3. Monthly backup on 1st of month at 4:00 AM
echo.
set /p CONFIRM="Do you want to continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Setup cancelled.
    pause
    exit /b 0
)
echo.

REM Set backup script path
set BACKUP_SCRIPT=%~dp0backup-database.bat

echo Creating scheduled tasks...
echo.

REM ========================================
REM Daily Backup Task
REM ========================================
echo [1/3] Creating daily backup task...

schtasks /create /tn "Purchase Requisition - Daily Backup" /tr "\"%BACKUP_SCRIPT%\" auto" /sc daily /st 02:00 /ru SYSTEM /f >nul 2>&1

if %errorlevel% equ 0 (
    echo       [OK] Daily backup scheduled for 2:00 AM
) else (
    echo       [ERROR] Failed to create daily backup task
)

REM ========================================
REM Weekly Backup Task
REM ========================================
echo [2/3] Creating weekly backup task...

schtasks /create /tn "Purchase Requisition - Weekly Backup" /tr "\"%BACKUP_SCRIPT%\" auto" /sc weekly /d SUN /st 03:00 /ru SYSTEM /f >nul 2>&1

if %errorlevel% equ 0 (
    echo       [OK] Weekly backup scheduled for Sunday 3:00 AM
) else (
    echo       [ERROR] Failed to create weekly backup task
)

REM ========================================
REM Monthly Backup Task
REM ========================================
echo [3/3] Creating monthly backup task...

schtasks /create /tn "Purchase Requisition - Monthly Backup" /tr "\"%BACKUP_SCRIPT%\" auto" /sc monthly /d 1 /st 04:00 /ru SYSTEM /f >nul 2>&1

if %errorlevel% equ 0 (
    echo       [OK] Monthly backup scheduled for 1st of month at 4:00 AM
) else (
    echo       [ERROR] Failed to create monthly backup task
)

echo.
echo ========================================
echo Backup Schedule Configured
echo ========================================
echo.
echo Scheduled Tasks Created:
echo   - Daily:   Every day at 2:00 AM
echo   - Weekly:  Every Sunday at 3:00 AM
echo   - Monthly: 1st of each month at 4:00 AM
echo.
echo Backups will be saved to:
echo   C:\Projects\purchase-requisition-system\backups\
echo.
echo To view or modify scheduled tasks:
echo   Press Win + R, type: taskschd.msc
echo.
echo To manually run a backup now:
echo   Run: backup-database.bat
echo.
echo To remove scheduled backups:
echo   Run: remove-backup-schedule.bat
echo.
pause
