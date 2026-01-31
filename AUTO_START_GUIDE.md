# Purchase Requisition System - Auto-Start Guide

This guide explains how to configure the Purchase Requisition System to start automatically at every reboot and be accessible at `http://pras:3001`.

## Files Created

1. **server_launcher.py** - Python script that runs the backend server with logging and auto-restart
2. **setup-autostart.ps1** - PowerShell script to configure Windows Task Scheduler
3. **setup-autostart.bat** - Batch file for easy setup execution

## Prerequisites

- Python 3.x installed and in PATH
- Node.js installed and in PATH
- Administrator privileges (for Task Scheduler setup)

## Quick Setup (Recommended)

### Option 1: Using Batch File

1. Right-click on `setup-autostart.bat`
2. Select "Run as administrator"
3. Follow the prompts
4. Choose 'Y' when asked if you want to start the server now

### Option 2: Using PowerShell

1. Open PowerShell as Administrator
2. Navigate to the project directory:
   ```powershell
   cd C:\Projects\purchase-requisition-system
   ```
3. Run the setup script:
   ```powershell
   .\setup-autostart.ps1
   ```

## Manual Setup

If you prefer to set up manually:

1. Open Task Scheduler (`taskschd.msc`)
2. Click "Create Task"
3. Configure:
   - **Name:** PurchaseRequisitionSystem
   - **Security options:** Run with highest privileges
   - **Trigger:** At startup
   - **Action:** Start a program
     - Program: `python`
     - Arguments: `"C:\Projects\purchase-requisition-system\server_launcher.py"`
     - Start in: `C:\Projects\purchase-requisition-system`

## Testing the Setup

### Test server_launcher.py manually:
```bash
python server_launcher.py
```

The server should start and be accessible at `http://pras:3001`

### Verify Task Scheduler:
```powershell
Get-ScheduledTask -TaskName "PurchaseRequisitionSystem"
```

## Managing the Service

### Start the server:
```powershell
Start-ScheduledTask -TaskName "PurchaseRequisitionSystem"
```

### Stop the server:
```powershell
Stop-ScheduledTask -TaskName "PurchaseRequisitionSystem"
```

### Check status:
```powershell
Get-ScheduledTask -TaskName "PurchaseRequisitionSystem" | Select-Object TaskName, State
```

### Remove auto-start:
```powershell
Unregister-ScheduledTask -TaskName "PurchaseRequisitionSystem" -Confirm:$false
```

## Accessing the Application

Once the server is running:

- **Backend API:** http://pras:3001
- **Frontend:** Open `frontend/index.html` in your browser or serve it via the backend

## Logging

Logs are stored in the `logs/` directory:
- File format: `backend_YYYYMMDD.log`
- Contains server output, errors, and restart information
- New log file created each day

## Troubleshooting

### Server doesn't start at reboot:

1. Check Task Scheduler:
   ```powershell
   Get-ScheduledTask -TaskName "PurchaseRequisitionSystem"
   ```

2. Check the log file in `logs/` directory

3. Verify Python and Node.js are in system PATH:
   ```bash
   python --version
   node --version
   ```

### Cannot access pras:3001:

1. Check if server is running:
   ```bash
   netstat -ano | findstr :3001
   ```

2. Verify hostname 'pras' resolves:
   ```bash
   ping pras
   ```

3. If hostname doesn't resolve, add to `C:\Windows\System32\drivers\etc\hosts`:
   ```
   127.0.0.1 pras
   ```

### Port 3001 already in use:

1. Find process using the port:
   ```bash
   netstat -ano | findstr :3001
   ```

2. Kill the process:
   ```powershell
   Stop-Process -Id <PID> -Force
   ```

### Dependencies missing:

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

## Features of server_launcher.py

- **Auto-restart:** Automatically restarts the server if it crashes (max 5 retries)
- **Logging:** All output logged to daily log files
- **Dependency check:** Verifies Node.js and npm packages before starting
- **Graceful shutdown:** Handles Ctrl+C properly
- **Real-time monitoring:** Shows server output in console and log file

## Security Notes

- The task runs with SYSTEM privileges for reliability
- Consider restricting file permissions in production
- Review CORS settings in `backend/server.js`
- Ensure `.env` file has appropriate secrets

## Support

For issues or questions:
1. Check the log files in `logs/` directory
2. Verify all prerequisites are installed
3. Test manual startup with `python server_launcher.py`
4. Review Task Scheduler logs in Event Viewer

---

**Created:** 2025-11-19
**Version:** 1.0
