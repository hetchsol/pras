@echo off
REM ============================================
REM Convert All Markdown Files to DOCX
REM ============================================

echo.
echo ========================================
echo  Markdown to DOCX Converter
echo ========================================
echo.

REM Create output directory
if not exist "docs-docx" mkdir docs-docx

echo Checking for Pandoc...
pandoc --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo Pandoc is not installed.
    echo.
    echo Option 1: Install Pandoc
    echo   Download from: https://pandoc.org/installing.html
    echo   Or install via Chocolatey: choco install pandoc
    echo.
    echo Option 2: Use PowerShell script with Word
    echo   Run: powershell -ExecutionPolicy Bypass -File scripts\convert-md-to-docx.ps1
    echo.
    choice /C YN /M "Do you want to install Pandoc now (requires admin)"
    if errorlevel 2 goto use_powershell
    if errorlevel 1 goto install_pandoc
) else (
    echo Pandoc found! Starting conversion...
    goto convert_with_pandoc
)

:install_pandoc
echo.
echo Installing Pandoc via winget...
winget install --id=JohnMacFarlane.Pandoc -e
if errorlevel 1 (
    echo.
    echo Installation failed. Please install manually from:
    echo https://pandoc.org/installing.html
    echo.
    goto use_powershell
)
echo.
echo Pandoc installed successfully!
goto convert_with_pandoc

:convert_with_pandoc
echo.
echo Converting markdown files to DOCX...
echo.

set count=0
for %%f in (*.md) do (
    echo Converting: %%f
    pandoc "%%f" -o "docs-docx\%%~nf.docx" --standalone
    set /a count+=1
)

echo.
echo ========================================
echo Conversion complete!
echo ========================================
echo.
echo Converted %count% files
echo Output directory: docs-docx\
echo.
goto end

:use_powershell
echo.
echo Using PowerShell with Word COM automation...
echo.
powershell -ExecutionPolicy Bypass -File scripts\convert-md-to-docx.ps1
goto end

:end
pause
