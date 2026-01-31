@echo off
REM Batch file to run the PowerShell setup script with Administrator privileges

echo ============================================================
echo Purchase Requisition System - Auto-Start Setup
echo ============================================================
echo.
echo This will configure the system to start automatically at reboot.
echo Administrator privileges are required.
echo.
pause

REM Run PowerShell script as Administrator
powershell -ExecutionPolicy Bypass -File "%~dp0setup-autostart.ps1"

pause
