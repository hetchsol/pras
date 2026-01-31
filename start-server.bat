@echo off
REM Quick start script for Purchase Requisition System

echo ============================================================
echo Purchase Requisition System - Backend Server
echo ============================================================
echo.
echo Starting server at http://pras:3001
echo Press Ctrl+C to stop the server
echo.
echo Logs will be saved to: logs\backend_%date:~-4%%date:~-7,2%%date:~-10,2%.log
echo.

python server_launcher.py

pause
