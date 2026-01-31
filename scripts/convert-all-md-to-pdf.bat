@echo off
REM ============================================
REM Convert All Markdown Files to PDF
REM ============================================

echo.
echo ========================================
echo  Markdown to PDF Converter
echo ========================================
echo.

node scripts\convert-md-to-pdf.js

echo.
echo Opening PDF directory...
start explorer.exe docs-pdf

echo.
pause
