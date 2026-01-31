@echo off
REM Purchase Requisition System - Cross-Subnet Access Test
REM This script tests connectivity and access from different subnets

echo ========================================
echo Purchase Requisition System
echo Cross-Subnet Access Test
echo ========================================
echo.

echo Checking Current Network Configuration...
echo ----------------------------------------
echo.

REM Get current IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP:~1!
    echo Current IP Address: !IP!
)

echo.
echo Expected Server IP: 10.96.32.87
echo Client Subnet: 10.96.33.x
echo.

REM Check if on correct network
echo Verifying network connection...
ipconfig | findstr "10.96.32" >nul
if %errorlevel% equ 0 (
    echo [OK] Connected to 10.96.32.x subnet
) else (
    echo [WARNING] Not connected to 10.96.32.x subnet
    echo Current network may be different
)
echo.

REM Test if services are running
echo Checking Services...
echo ----------------------------------------
echo.

echo [1/3] Testing Backend (port 3001)...
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost:3001 >nul 2>&1
if %errorlevel% equ 0 (
    echo       [OK] Backend is running
) else (
    echo       [ERROR] Backend not responding
    echo       Please start backend: cd backend ^&^& npm start
)

echo [2/3] Testing Nginx (port 80)...
curl -s -o nul -w "HTTP Status: %%{http_code}\n" http://localhost >nul 2>&1
if %errorlevel% equ 0 (
    echo       [OK] Nginx is running
) else (
    echo       [ERROR] Nginx not responding
)

echo [3/3] Testing application access...
curl -s http://localhost -I | findstr "HTTP" >nul 2>&1
if %errorlevel% equ 0 (
    echo       [OK] Application accessible
) else (
    echo       [ERROR] Application not accessible
)

echo.
echo Checking Firewall Rules...
echo ----------------------------------------
echo.

netsh advfirewall firewall show rule name="Purchase Requisition - HTTP 10.96.33.x" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Firewall rule for 10.96.33.x exists
) else (
    echo [WARNING] Firewall rule not configured
    echo Run: configure-cross-subnet-access.bat (as Administrator)
)

echo.
echo ========================================
echo Access Information
echo ========================================
echo.
echo From this server:
echo   http://localhost
echo   http://127.0.0.1
echo.
echo From computers on 10.96.32.x subnet:
echo   http://10.96.32.87
echo   http://PRAS
echo.
echo From computers on 10.96.33.x subnet:
echo   http://10.96.32.87
echo   http://PRAS
echo.
echo ========================================
echo Testing Instructions for Remote Users
echo ========================================
echo.
echo Have a user on 10.96.33.x network try:
echo.
echo 1. Ping test:
echo    ping 10.96.32.87
echo    (Should get replies)
echo.
echo 2. Web browser:
echo    http://10.96.32.87
echo    (Should show Purchase Requisition login)
echo.
echo If ping fails:
echo   - Check network routing between subnets
echo   - Contact network administrator
echo.
echo If browser fails but ping works:
echo   - Check firewall rules on this server
echo   - Run: configure-cross-subnet-access.bat
echo.
pause
