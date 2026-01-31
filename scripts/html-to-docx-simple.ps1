# Simple HTML to DOCX Converter
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$htmlFiles = Get-ChildItem "docs-docx\*.html"
$count = 0

foreach ($file in $htmlFiles) {
    $docxPath = $file.FullName -replace '\.html$', '.docx'
    if (!(Test-Path $docxPath)) {
        Write-Host "Converting: $($file.Name)"
        $doc = $word.Documents.Open($file.FullName)
        $doc.SaveAs([ref]$docxPath, [ref]16)
        $doc.Close()
        $count++
    }
}

$word.Quit()
Write-Host "Converted $count files to DOCX"
