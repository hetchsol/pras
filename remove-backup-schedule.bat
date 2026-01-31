@echo off
REM Purchase Requisition System - Remove Backup Schedule
REM This script removes all scheduled backup tasks

echo ========================================
echo Purchase Requisition System
echo Remove Backup Schedule
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

echo WARNING: This will remove all scheduled backup tasks.
echo Your existing backups will NOT be deleted.
echo.
set /p CONFIRM="Are you sure you want to continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Removal cancelled.
    pause
    exit /b 0
)
echo.

echo Removing scheduled tasks...
echo.

REM Remove Daily Backup Task
schtasks /delete /tn "Purchase Requisition - Daily Backup" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Daily backup task removed
) else (
    echo [INFO] Daily backup task not found or already removed
)

REM Remove Weekly Backup Task
schtasks /delete /tn "Purchase Requisition - Weekly Backup" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Weekly backup task removed
) else (
    echo [INFO] Weekly backup task not found or already removed
)

REM Remove Monthly Backup Task
schtasks /delete /tn "Purchase Requisition - Monthly Backup" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Monthly backup task removed
) else (
    echo [INFO] Monthly backup task not found or already removed
)

echo.
echo ========================================
echo Backup Schedule Removed
echo ========================================
echo.
echo All scheduled backup tasks have been removed.
echo.
echo Your existing backups are still available at:
echo   C:\Projects\purchase-requisition-system\backups\
echo.
echo To re-enable scheduled backups:
echo   Run: schedule-backups.bat
echo.
pause
