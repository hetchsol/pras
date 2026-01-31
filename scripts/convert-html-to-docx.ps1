# PowerShell Script to Convert HTML to DOCX using Microsoft Word
# Requires Microsoft Word to be installed

param(
    [string]$InputDir = ".\docs-docx",
    [string]$OutputDir = ".\docs-docx"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " HTML to DOCX Converter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Word is available
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0  # wdAlertsNone
    Write-Host "✓ Microsoft Word detected" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Microsoft Word not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Microsoft Word or use one of these alternatives:" -ForegroundColor Yellow
    Write-Host "1. Install Pandoc: winget install --id=JohnMacFarlane.Pandoc -e" -ForegroundColor Yellow
    Write-Host "2. Open HTML files in Word and save as DOCX manually" -ForegroundColor Yellow
    Write-Host "3. Use an online converter like CloudConvert" -ForegroundColor Yellow
    exit 1
}

# Get all .html files
$htmlFiles = Get-ChildItem -Path $InputDir -Filter "*.html" -File

if ($htmlFiles.Count -eq 0) {
    Write-Host "No HTML files found in $InputDir" -ForegroundColor Yellow
    $word.Quit()
    exit 0
}

Write-Host "Found $($htmlFiles.Count) HTML files to convert" -ForegroundColor Green
Write-Host ""

$converted = 0
$failed = 0
$skipped = 0

foreach ($file in $htmlFiles) {
    $docxFile = Join-Path $OutputDir ($file.BaseName + ".docx")

    # Check if DOCX already exists
    if (Test-Path $docxFile) {
        Write-Host "Skipping: $($file.Name) (DOCX exists)" -ForegroundColor Yellow
        $skipped++
        continue
    }

    Write-Host "Converting: $($file.Name)" -NoNewline

    try {
        # Open HTML file in Word
        $doc = $word.Documents.Open($file.FullName)

        # Save as DOCX
        $doc.SaveAs([ref]$docxFile, [ref]16)  # 16 = wdFormatXMLDocument (DOCX)

        # Close document
        $doc.Close()

        Write-Host " -> SUCCESS" -ForegroundColor Green
        $converted++

    } catch {
        Write-Host " -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $failed++

        # Close document if it's still open
        try {
            if ($doc) {
                $doc.Close([ref]$false)
            }
        } catch {}
    }
}

# Cleanup Word
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Conversion Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total files: $($htmlFiles.Count)" -ForegroundColor White
Write-Host "Converted: $converted" -ForegroundColor Green
Write-Host "Skipped: $skipped" -ForegroundColor Yellow
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host ""
Write-Host "Output directory: $OutputDir" -ForegroundColor Cyan
Write-Host ""

# Open output directory
if ($converted -gt 0) {
    Write-Host "Opening output directory..." -ForegroundColor Cyan
    Start-Process explorer.exe $OutputDir
}
