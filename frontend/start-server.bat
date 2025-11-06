@echo off
echo ========================================
echo  Purchase Requisition System - Frontend
echo ========================================
echo.
echo Starting frontend server on port 3000...
echo.
echo Open your browser to: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python -m http.server 3000

pause
