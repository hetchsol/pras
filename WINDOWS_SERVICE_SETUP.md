# Windows Service Setup Guide
## Auto-Start Purchase Requisition System on Boot

This guide will help you configure your Purchase Requisition System to automatically start when Windows boots, running as background services.

---

## Method 1: Using NSSM (Recommended)

NSSM (Non-Sucking Service Manager) is the best tool for running Node.js and Nginx as Windows services.

### Step 1: Download NSSM

1. Go to: https://nssm.cc/download
2. Download the latest version (e.g., `nssm-2.24.zip`)
3. Extract the ZIP file
4. Copy the appropriate version to a permanent location:
   - For 64-bit Windows: Copy `win64\nssm.exe` to `C:\nssm\nssm.exe`
   - For 32-bit Windows: Copy `win32\nssm.exe` to `C:\nssm\nssm.exe`

### Step 2: Add NSSM to System PATH (Optional but Recommended)

**Option A - Using GUI:**
1. Press `Win + Pause/Break` (or right-click "This PC" → Properties)
2. Click "Advanced system settings"
3. Click "Environment Variables"
4. Under "System variables", find and edit "Path"
5. Click "New" and add: `C:\nssm`
6. Click "OK" on all dialogs

**Option B - Using PowerShell (as Administrator):**
```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\nssm", [EnvironmentVariableTarget]::Machine)
```

### Step 3: Install Nginx as a Service

**Open PowerShell or Command Prompt as Administrator**, then run:

```bash
# Navigate to NSSM directory
cd C:\nssm

# Install Nginx service
nssm install PurchaseRequisition-Nginx C:\nginx\nginx.exe

# Set service to start automatically
nssm set PurchaseRequisition-Nginx Start SERVICE_AUTO_START

# Set service description
nssm set PurchaseRequisition-Nginx Description "Nginx web server for Purchase Requisition System (Port 80)"

# Set display name
nssm set PurchaseRequisition-Nginx DisplayName "Purchase Requisition - Nginx"

# Set working directory
nssm set PurchaseRequisition-Nginx AppDirectory C:\nginx

# Set restart behavior (restart on crash)
nssm set PurchaseRequisition-Nginx AppExit Default Restart
nssm set PurchaseRequisition-Nginx AppRestartDelay 5000

# Set log files
nssm set PurchaseRequisition-Nginx AppStdout C:\nginx\logs\service-stdout.log
nssm set PurchaseRequisition-Nginx AppStderr C:\nginx\logs\service-stderr.log
```

### Step 4: Install Node.js Backend as a Service

**In the same Administrator PowerShell/Command Prompt:**

```bash
# Find your Node.js installation path
where node
# Example output: C:\Program Files\nodejs\node.exe

# Install Node.js backend service
nssm install PurchaseRequisition-Backend "C:\Program Files\nodejs\node.exe" server.js

# Set working directory to backend folder
nssm set PurchaseRequisition-Backend AppDirectory C:\Projects\purchase-requisition-system\backend

# Set service to start automatically (but after Nginx)
nssm set PurchaseRequisition-Backend Start SERVICE_AUTO_START
nssm set PurchaseRequisition-Backend DependOnService PurchaseRequisition-Nginx

# Set service description
nssm set PurchaseRequisition-Backend Description "Node.js backend for Purchase Requisition System (Port 3001)"

# Set display name
nssm set PurchaseRequisition-Backend DisplayName "Purchase Requisition - Backend"

# Set environment variables (load from .env)
nssm set PurchaseRequisition-Backend AppEnvironmentExtra NODE_ENV=production

# Set restart behavior
nssm set PurchaseRequisition-Backend AppExit Default Restart
nssm set PurchaseRequisition-Backend AppRestartDelay 5000

# Set log files
nssm set PurchaseRequisition-Backend AppStdout C:\Projects\purchase-requisition-system\backend\logs\service-stdout.log
nssm set PurchaseRequisition-Backend AppStderr C:\Projects\purchase-requisition-system\backend\logs\service-stderr.log

# Set log rotation (optional - prevents huge log files)
nssm set PurchaseRequisition-Backend AppRotateFiles 1
nssm set PurchaseRequisition-Backend AppRotateOnline 1
nssm set PurchaseRequisition-Backend AppRotateSeconds 86400
nssm set PurchaseRequisition-Backend AppRotateBytes 1048576
```

### Step 5: Create Logs Directory

```bash
# Create logs directory for backend if it doesn't exist
mkdir C:\Projects\purchase-requisition-system\backend\logs
```

### Step 6: Start the Services

```bash
# Start Nginx service
nssm start PurchaseRequisition-Nginx

# Wait a few seconds, then start backend
timeout /t 3 /nobreak
nssm start PurchaseRequisition-Backend
```

### Step 7: Verify Services are Running

**Using Command Line:**
```bash
# Check service status
nssm status PurchaseRequisition-Nginx
nssm status PurchaseRequisition-Backend

# Or use Windows service manager
sc query PurchaseRequisition-Nginx
sc query PurchaseRequisition-Backend
```

**Using Services GUI:**
1. Press `Win + R`
2. Type: `services.msc`
3. Press Enter
4. Look for:
   - "Purchase Requisition - Nginx"
   - "Purchase Requisition - Backend"
5. Both should show "Running" status and "Automatic" startup type

### Step 8: Test Auto-Start

1. **Restart your computer**
2. **Wait 30-60 seconds** after login
3. **Open browser** and go to: http://localhost
4. **Your application should be running** automatically!

---

## Managing Services

### View Service Status
```bash
nssm status PurchaseRequisition-Nginx
nssm status PurchaseRequisition-Backend
```

### Start Services
```bash
nssm start PurchaseRequisition-Nginx
nssm start PurchaseRequisition-Backend
```

### Stop Services
```bash
nssm stop PurchaseRequisition-Backend
nssm stop PurchaseRequisition-Nginx
```

### Restart Services
```bash
nssm restart PurchaseRequisition-Backend
nssm restart PurchaseRequisition-Nginx
```

### Remove Services (Uninstall)
```bash
# Stop services first
nssm stop PurchaseRequisition-Backend
nssm stop PurchaseRequisition-Nginx

# Remove services
nssm remove PurchaseRequisition-Backend confirm
nssm remove PurchaseRequisition-Nginx confirm
```

### Edit Service Configuration
```bash
# Open GUI editor for a service
nssm edit PurchaseRequisition-Backend
nssm edit PurchaseRequisition-Nginx
```

### View Service Logs
```bash
# Nginx logs
type C:\nginx\logs\service-stdout.log
type C:\nginx\logs\service-stderr.log

# Backend logs
type C:\Projects\purchase-requisition-system\backend\logs\service-stdout.log
type C:\Projects\purchase-requisition-system\backend\logs\service-stderr.log
```

---

## Method 2: Using Windows Task Scheduler (Alternative)

If you prefer not to use NSSM, you can use Task Scheduler:

### Create Scheduled Task for Nginx

1. **Open Task Scheduler**: Press `Win + R`, type `taskschd.msc`, press Enter
2. **Create Task** (not Basic Task):
   - **General Tab**:
     - Name: `Purchase Requisition - Nginx`
     - Description: `Start Nginx on boot`
     - Select: "Run whether user is logged on or not"
     - Select: "Run with highest privileges"
     - Configure for: Windows 10

   - **Triggers Tab**:
     - Click "New"
     - Begin the task: "At startup"
     - Delay task for: 10 seconds
     - Click "OK"

   - **Actions Tab**:
     - Click "New"
     - Action: "Start a program"
     - Program/script: `C:\nginx\nginx.exe`
     - Start in: `C:\nginx`
     - Click "OK"

   - **Conditions Tab**:
     - Uncheck "Start the task only if the computer is on AC power"

   - **Settings Tab**:
     - Check "Allow task to be run on demand"
     - Check "If the task fails, restart every: 1 minute, Attempt to restart up to: 3 times"
     - If running task does not end when requested: "Do not start a new instance"

3. **Click "OK"** and enter your Windows password if prompted

### Create Scheduled Task for Node.js Backend

Repeat the above steps but with these differences:
- **Name**: `Purchase Requisition - Backend`
- **Description**: `Start Node.js backend on boot`
- **Delay task for**: 15 seconds (to start after Nginx)
- **Program/script**: `C:\Program Files\nodejs\node.exe`
- **Add arguments**: `server.js`
- **Start in**: `C:\Projects\purchase-requisition-system\backend`

---

## Method 3: Using Startup Folder (Simplest but Less Reliable)

This is the simplest method but services won't run in the background.

### Step 1: Create Startup Shortcut

1. Press `Win + R`
2. Type: `shell:startup`
3. Press Enter (opens Startup folder)
4. Create a shortcut to: `C:\Projects\purchase-requisition-system\start-system.bat`
5. Right-click shortcut → Properties
6. Change "Run": "Minimized"
7. Click "OK"

**Pros**: Very simple, no admin required
**Cons**: Only starts when you log in, shows command windows

---

## Troubleshooting

### Services Won't Start

**Check Event Viewer:**
1. Press `Win + R`, type `eventvwr.msc`
2. Navigate to: Windows Logs → Application
3. Look for errors from your services

**Common Issues:**
- **Wrong path to node.exe**: Run `where node` to find correct path
- **Missing dependencies**: Ensure npm packages are installed
- **Port already in use**: Check if another service is using ports 80 or 3001
- **Permissions**: Ensure NSSM is run as Administrator

### Service Starts but Application Not Working

**Check logs:**
```bash
# Backend logs
type C:\Projects\purchase-requisition-system\backend\logs\service-stderr.log

# Nginx logs
type C:\nginx\logs\error.log
```

### Service Keeps Restarting

**Check for errors in the application:**
1. Stop the service: `nssm stop PurchaseRequisition-Backend`
2. Run manually to see errors:
   ```bash
   cd C:\Projects\purchase-requisition-system\backend
   node server.js
   ```
3. Fix any errors
4. Start service again: `nssm start PurchaseRequisition-Backend`

### Database Locked Error

**SQLite might have permission issues when running as service:**
- Ensure the database file has write permissions
- Consider moving database to a service-accessible location
- Or run service as your user account instead of SYSTEM

To run as your user:
```bash
nssm set PurchaseRequisition-Backend ObjectName .\YourUsername YourPassword
```

---

## Best Practices

### 1. Monitor Service Health

Create a simple monitoring script `check-services.bat`:

```batch
@echo off
echo Checking Purchase Requisition Services...
echo.

nssm status PurchaseRequisition-Nginx
if %errorlevel% neq 0 (
    echo WARNING: Nginx service not running!
    echo Attempting to start...
    nssm start PurchaseRequisition-Nginx
)

nssm status PurchaseRequisition-Backend
if %errorlevel% neq 0 (
    echo WARNING: Backend service not running!
    echo Attempting to start...
    nssm start PurchaseRequisition-Backend
)

echo.
echo Status check complete.
pause
```

### 2. Regular Log Rotation

Logs can grow large. Either:
- Use NSSM's built-in rotation (shown in setup)
- Or create a scheduled task to clean old logs monthly

### 3. Backup Before Updates

Before updating the application:
```bash
# Stop services
nssm stop PurchaseRequisition-Backend
nssm stop PurchaseRequisition-Nginx

# Make your updates

# Start services
nssm start PurchaseRequisition-Nginx
nssm start PurchaseRequisition-Backend
```

### 4. Test After Windows Updates

Windows updates can sometimes affect services. After major updates:
1. Check service status
2. Test application access
3. Review error logs

---

## Uninstalling Services

If you need to completely remove the services:

```bash
# Stop services
nssm stop PurchaseRequisition-Backend
nssm stop PurchaseRequisition-Nginx

# Remove services
nssm remove PurchaseRequisition-Backend confirm
nssm remove PurchaseRequisition-Nginx confirm

# Verify removal
sc query PurchaseRequisition-Backend
sc query PurchaseRequisition-Nginx
```

---

## Summary

After completing this setup:

✅ Nginx and Node.js run as Windows services
✅ Automatically start on boot
✅ Run in background (no console windows)
✅ Auto-restart on crash
✅ Proper logging with rotation
✅ Manageable via Windows Services GUI
✅ Professional production deployment

**Recommended Method**: NSSM (Method 1) - Most reliable and feature-rich

---

## Quick Reference

| Task | Command |
|------|---------|
| Install service | `nssm install ServiceName "C:\path\to\exe"` |
| Start service | `nssm start ServiceName` |
| Stop service | `nssm stop ServiceName` |
| Restart service | `nssm restart ServiceName` |
| Check status | `nssm status ServiceName` |
| Edit service | `nssm edit ServiceName` |
| Remove service | `nssm remove ServiceName confirm` |
| View in GUI | `services.msc` |

---

## Support Resources

- NSSM Documentation: https://nssm.cc/usage
- Windows Services Guide: https://docs.microsoft.com/en-us/windows/win32/services/services
- Node.js Windows Services: https://nodejs.org/en/docs/guides/getting-started-guide/

If you encounter issues, check the service logs first, then the application logs.
