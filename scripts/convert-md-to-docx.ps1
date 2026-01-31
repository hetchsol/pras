# PowerShell Script to Convert Markdown to DOCX using Word
# Requires Microsoft Word to be installed

param(
    [string]$SourceDir = ".",
    [string]$OutputDir = ".\docs-docx"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Markdown to DOCX Converter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory if it doesn't exist
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Created output directory: $OutputDir" -ForegroundColor Green
}

# Get all .md files
$mdFiles = Get-ChildItem -Path $SourceDir -Filter "*.md" -File

if ($mdFiles.Count -eq 0) {
    Write-Host "No markdown files found in $SourceDir" -ForegroundColor Yellow
    exit
}

Write-Host "Found $($mdFiles.Count) markdown files" -ForegroundColor Green
Write-Host ""

# Check if Word is available
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $wordAvailable = $true
    Write-Host "Microsoft Word detected - using Word for conversion" -ForegroundColor Green
    Write-Host ""
} catch {
    $wordAvailable = $false
    Write-Host "Microsoft Word not detected - using basic conversion" -ForegroundColor Yellow
    Write-Host ""
}

$converted = 0
$failed = 0

foreach ($file in $mdFiles) {
    $outputFile = Join-Path $OutputDir ($file.BaseName + ".docx")

    Write-Host "Converting: $($file.Name)" -NoNewline

    try {
        if ($wordAvailable) {
            # Convert using Word
            $doc = $word.Documents.Add()

            # Read markdown content
            $content = Get-Content $file.FullName -Raw

            # Basic markdown to formatted text conversion
            $content = $content -replace '^# (.+)$', '$1' # H1
            $content = $content -replace '^## (.+)$', '$1' # H2
            $content = $content -replace '^### (.+)$', '$1' # H3
            $content = $content -replace '\*\*(.+?)\*\*', '$1' # Bold
            $content = $content -replace '\*(.+?)\*', '$1' # Italic
            $content = $content -replace '`(.+?)`', '$1' # Code

            # Add content to Word document
            $selection = $word.Selection
            $selection.TypeText($content)

            # Save as DOCX
            $doc.SaveAs([ref]$outputFile, [ref]16) # 16 = wdFormatDocumentDefault
            $doc.Close()

            Write-Host " -> SUCCESS" -ForegroundColor Green
            $converted++
        } else {
            # Fallback: Create a simple DOCX structure
            # This requires the OpenXML SDK, so we'll use a different approach

            # For systems without Word, we'll create HTML and save as .htm
            $htmlFile = Join-Path $OutputDir ($file.BaseName + ".html")
            $content = Get-Content $file.FullName -Raw

            # Basic markdown to HTML conversion
            $html = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>$($file.BaseName)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; border-bottom: 2px solid #95a5a6; padding-bottom: 8px; margin-top: 30px; }
        h3 { color: #34495e; margin-top: 25px; }
        code { background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
        pre { background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        strong { color: #2c3e50; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #3498db; color: white; }
        ul, ol { margin: 10px 0; padding-left: 30px; }
        blockquote { border-left: 4px solid #3498db; padding-left: 20px; margin: 20px 0; color: #555; }
    </style>
</head>
<body>
"@

            # Convert markdown to HTML (basic)
            $content = $content -replace '^# (.+)$', '<h1>$1</h1>' # H1
            $content = $content -replace '^## (.+)$', '<h2>$1</h2>' # H2
            $content = $content -replace '^### (.+)$', '<h3>$1</h3>' # H3
            $content = $content -replace '^#### (.+)$', '<h4>$1</h4>' # H4
            $content = $content -replace '\*\*(.+?)\*\*', '<strong>$1</strong>' # Bold
            $content = $content -replace '\*(.+?)\*', '<em>$1</em>' # Italic
            $content = $content -replace '`([^`]+)`', '<code>$1</code>' # Inline code
            $content = $content -replace '^- (.+)$', '<li>$1</li>' # List items
            $content = $content -replace '\n\n', '</p><p>' # Paragraphs
            $content = $content -replace '^(.+)$', '<p>$1</p>' -split "`n" -join "`n"

            $html += $content
            $html += @"

</body>
</html>
"@

            $html | Out-File -FilePath $htmlFile -Encoding UTF8

            Write-Host " -> HTML ($htmlFile)" -ForegroundColor Yellow
            $converted++
        }
    } catch {
        Write-Host " -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

# Cleanup Word if it was opened
if ($wordAvailable) {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Conversion Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total files: $($mdFiles.Count)" -ForegroundColor White
Write-Host "Converted: $converted" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host ""
Write-Host "Output directory: $OutputDir" -ForegroundColor Cyan
Write-Host ""

if (!$wordAvailable) {
    Write-Host "Note: HTML files were created instead of DOCX." -ForegroundColor Yellow
    Write-Host "To convert to DOCX:" -ForegroundColor Yellow
    Write-Host "1. Install Pandoc: https://pandoc.org/installing.html" -ForegroundColor Yellow
    Write-Host "2. Run: pandoc input.md -o output.docx" -ForegroundColor Yellow
    Write-Host ""
}
