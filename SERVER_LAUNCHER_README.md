# Purchase Requisition System - Server Launcher

## Overview

The `server_launcher.py` script is a robust Python-based launcher for the Purchase Requisition System backend. It provides automatic startup, monitoring, logging, and restart capabilities.

## Files Created

| File | Description |
|------|-------------|
| `server_launcher.py` | Main Python script that launches and monitors the backend |
| `setup-autostart.ps1` | PowerShell script to configure Windows Task Scheduler |
| `setup-autostart.bat` | Batch wrapper for easy setup |
| `start-server.bat` | Quick manual start script |
| `AUTO_START_GUIDE.md` | Detailed setup and troubleshooting guide |

## Quick Start

### Manual Start (Testing)
```bash
# Simple double-click or run:
start-server.bat

# Or directly:
python server_launcher.py
```

### Auto-Start at Reboot (Production)
```bash
# Run as Administrator:
setup-autostart.bat

# Follow the prompts to configure Windows Task Scheduler
```

## Features

### 🚀 Automatic Server Management
- Launches Node.js backend server automatically
- Monitors server process in real-time
- Auto-restarts on failure (up to 5 retries)
- Graceful shutdown handling

### 📝 Comprehensive Logging
- Daily log files in `logs/` directory
- Format: `backend_YYYYMMDD.log`
- Captures all server output and errors
- Real-time console output with timestamps

### 🔧 Dependency Management
- Checks for Node.js installation
- Verifies npm dependencies
- Auto-runs `npm install` if needed

### 🌐 Network Configuration
- Configured to run on `pras:3001`
- Accessible via browser at `http://pras:3001`
- Environment variables configurable

## System Requirements

- **Python 3.x** - Installed and in system PATH
- **Node.js** - Installed and in system PATH
- **Windows OS** - For Task Scheduler auto-start
- **Administrator Rights** - For setting up auto-start

## Configuration

### Server Settings
Edit `server_launcher.py` to customize:

```python
# Configuration section (lines 38-44)
BACKEND_DIR = Path(__file__).parent / 'backend'
NODE_SCRIPT = 'server.js'
HOST = 'pras'           # Change hostname here
PORT = 3001             # Change port here
MAX_RETRIES = 5         # Number of restart attempts
RETRY_DELAY = 10        # Seconds between retries
```

### Environment Variables
The script sets:
- `PORT` - Server port (default: 3001)
- `HOST` - Server hostname (default: pras)

Additional environment variables can be configured in `.env` file in the backend directory.

## Usage Examples

### Start Server Manually
```bash
# Using batch file
start-server.bat

# Using Python directly
python server_launcher.py

# In background (Windows)
start /B python server_launcher.py
```

### Manage Auto-Start Service

#### Setup Auto-Start
```powershell
# Run as Administrator
.\setup-autostart.ps1
```

#### Start/Stop Service
```powershell
# Start
Start-ScheduledTask -TaskName "PurchaseRequisitionSystem"

# Stop
Stop-ScheduledTask -TaskName "PurchaseRequisitionSystem"

# Check status
Get-ScheduledTask -TaskName "PurchaseRequisitionSystem" | Select TaskName, State
```

#### Remove Auto-Start
```powershell
Unregister-ScheduledTask -TaskName "PurchaseRequisitionSystem" -Confirm:$false
```

## Accessing the Application

Once the server is running:

1. **Backend API**: `http://pras:3001/api/...`
2. **Frontend**: Open `frontend/index.html` in browser or access via server
3. **Health Check**: `curl http://pras:3001`

### If "pras" hostname doesn't resolve:

Add to `C:\Windows\System32\drivers\etc\hosts`:
```
127.0.0.1 pras
```

Or access via localhost:
- `http://localhost:3001`

## Log Files

### Location
All logs are stored in: `C:\Projects\purchase-requisition-system\logs/`

### Format
```
YYYY-MM-DD HH:MM:SS,mmm - LEVEL - Message
```

### Example
```
2025-11-19 15:36:56,138 - INFO - Starting Purchase Requisition System Backend
2025-11-19 15:36:56,203 - INFO - Node.js version: v24.10.0
2025-11-19 15:36:56,211 - INFO - Backend server started with PID: 11312
2025-11-19 15:36:56,211 - INFO - Access the application at: http://pras:3001
```

## Troubleshooting

### Server Won't Start

1. **Check Python Installation**
   ```bash
   python --version
   ```

2. **Check Node.js Installation**
   ```bash
   node --version
   npm --version
   ```

3. **Check Dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Review Logs**
   ```bash
   # Check latest log file
   type logs\backend_20251119.log
   ```

### Port Already in Use

1. **Find Process**
   ```bash
   netstat -ano | findstr :3001
   ```

2. **Kill Process**
   ```powershell
   # Get PID from netstat output
   Stop-Process -Id <PID> -Force
   ```

### Auto-Start Not Working

1. **Verify Task Exists**
   ```powershell
   Get-ScheduledTask -TaskName "PurchaseRequisitionSystem"
   ```

2. **Check Task History**
   - Open Task Scheduler (`taskschd.msc`)
   - Find "PurchaseRequisitionSystem"
   - View History tab

3. **Test Manual Start**
   ```powershell
   Start-ScheduledTask -TaskName "PurchaseRequisitionSystem"
   ```

### Unicode/Encoding Errors

The script handles Unicode properly with UTF-8 encoding. If you see encoding errors:
- Logs are saved with UTF-8 encoding
- Console output uses UTF-8 with error replacement
- Server output is captured with UTF-8

## How It Works

### Startup Sequence
1. Create logs directory if needed
2. Configure logging (file + console)
3. Check Node.js installation
4. Verify backend dependencies
5. Set environment variables (PORT, HOST)
6. Launch Node.js server process
7. Monitor server output
8. Log all activity

### Monitoring Loop
- Continuously reads server stdout/stderr
- Logs all output with timestamps
- Detects process termination
- Implements retry logic on failure
- Handles graceful shutdown (Ctrl+C)

### Auto-Restart Logic
```
Attempt 1 → Failure → Wait 10s → Attempt 2 → ... → Max 5 attempts
```

## Security Considerations

- Task runs with SYSTEM privileges (for reliability)
- Review CORS settings in `backend/server.js`
- Ensure `.env` file has proper permissions
- Logs may contain sensitive information
- Restrict access to log directory in production

## Performance

- **Startup Time**: ~2-3 seconds
- **Memory**: Minimal overhead (~10-20 MB for Python process)
- **CPU**: Negligible when idle
- **Logs**: Rotated daily automatically

## Best Practices

1. **Development**: Use `start-server.bat` for manual control
2. **Production**: Use Task Scheduler auto-start
3. **Monitor Logs**: Regularly check `logs/` directory
4. **Security**: Don't commit `.env` file with secrets
5. **Updates**: Restart server after code changes

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-19 | Initial release |
| | | - Python launcher with logging |
| | | - Auto-start configuration |
| | | - Unicode handling |
| | | - Retry logic |

## Support

For issues:
1. Check log files in `logs/` directory
2. Verify prerequisites (Python, Node.js)
3. Review `AUTO_START_GUIDE.md`
4. Test manual start: `python server_launcher.py`

## License

Part of the Purchase Requisition System project.

---

**Last Updated**: 2025-11-19
**Tested On**: Windows 10/11, Python 3.13, Node.js 24.10
