@echo off
REM Purchase Requisition System - Cross-Subnet Access Configuration
REM This script configures Windows Firewall for access from subnet 10.96.33.x

echo ========================================
echo Purchase Requisition System
echo Cross-Subnet Access Configuration
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

echo Server Configuration:
echo ----------------------------------------
echo Server IP: 10.96.32.87 (on subnet 10.96.32.x)
echo Client Subnet: 10.96.33.0/24
echo.

echo Configuring Windows Firewall...
echo.

REM Allow HTTP (port 80) from subnet 10.96.33.x
echo [1/2] Adding firewall rule for HTTP (port 80) from 10.96.33.x...
netsh advfirewall firewall delete rule name="Purchase Requisition - HTTP 10.96.33.x" >nul 2>&1
netsh advfirewall firewall add rule name="Purchase Requisition - HTTP 10.96.33.x" dir=in action=allow protocol=TCP localport=80 remoteip=10.96.33.0/24

if %errorlevel% equ 0 (
    echo       [OK] HTTP firewall rule added
) else (
    echo       [ERROR] Failed to add HTTP firewall rule
)

REM Allow Backend (port 3001) from subnet 10.96.33.x (optional, for direct API access)
echo [2/2] Adding firewall rule for Backend (port 3001) from 10.96.33.x...
netsh advfirewall firewall delete rule name="Purchase Requisition - Backend 10.96.33.x" >nul 2>&1
netsh advfirewall firewall add rule name="Purchase Requisition - Backend 10.96.33.x" dir=in action=allow protocol=TCP localport=3001 remoteip=10.96.33.0/24

if %errorlevel% equ 0 (
    echo       [OK] Backend firewall rule added
) else (
    echo       [ERROR] Failed to add Backend firewall rule
)

echo.
echo ========================================
echo Firewall Configuration Complete
echo ========================================
echo.
echo Firewall rules added:
echo   - Allow HTTP (port 80) from 10.96.33.0/24
echo   - Allow Backend (port 3001) from 10.96.33.0/24
echo.
echo Current firewall rules:
netsh advfirewall firewall show rule name="Purchase Requisition - HTTP 10.96.33.x"
echo.
netsh advfirewall firewall show rule name="Purchase Requisition - Backend 10.96.33.x"
echo.
echo ========================================
echo Next Steps
echo ========================================
echo.
echo 1. Ensure your laptop is connected to 10.96.32.x network
echo 2. Verify your IP is 10.96.32.87
echo 3. Restart the backend service: restart-services.bat
echo.
echo Users on 10.96.33.x can now access:
echo   http://10.96.32.87
echo   http://PRAS
echo.
pause
