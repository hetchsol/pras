# PowerShell Script to Setup Auto-Start for Purchase Requisition System
# This creates a Windows Task Scheduler task to run server_launcher.py at every reboot

# Requires Administrator privileges
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "This script requires Administrator privileges. Please run as Administrator."
    pause
    exit
}

# Configuration
$TaskName = "PurchaseRequisitionSystem"
$ScriptPath = Join-Path $PSScriptRoot "server_launcher.py"
$PythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source

if (-not $PythonPath) {
    Write-Error "Python is not found in PATH. Please install Python first."
    pause
    exit
}

Write-Host "=" * 60
Write-Host "Setting up Auto-Start for Purchase Requisition System"
Write-Host "=" * 60
Write-Host "Task Name: $TaskName"
Write-Host "Script Path: $ScriptPath"
Write-Host "Python Path: $PythonPath"
Write-Host ""

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "Task '$TaskName' already exists. Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the action (run Python script)
$Action = New-ScheduledTaskAction -Execute $PythonPath -Argument "`"$ScriptPath`"" -WorkingDirectory $PSScriptRoot

# Create the trigger (at startup)
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Create the principal (run with highest privileges)
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Create the settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365)

# Register the scheduled task
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description "Automatically starts the Purchase Requisition System backend server at system startup"

    Write-Host ""
    Write-Host "SUCCESS: Task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The Purchase Requisition System will now start automatically at every reboot."
    Write-Host "Server will be accessible at: http://pras:3001"
    Write-Host ""
    Write-Host "To manage the task:"
    Write-Host "  - View: taskschd.msc (Task Scheduler)"
    Write-Host "  - Start manually: Start-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  - Stop: Stop-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  - Remove: Unregister-ScheduledTask -TaskName '$TaskName'"
    Write-Host ""

    # Ask if user wants to start the task now
    $StartNow = Read-Host "Do you want to start the server now? (Y/N)"
    if ($StartNow -eq 'Y' -or $StartNow -eq 'y') {
        Write-Host "Starting task..."
        Start-ScheduledTask -TaskName $TaskName
        Write-Host "Task started! Server should be available at http://pras:3001 in a few moments." -ForegroundColor Green
    }
}
catch {
    Write-Error "Failed to create scheduled task: $_"
    pause
    exit 1
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
pause
