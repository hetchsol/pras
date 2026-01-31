# Nginx Setup Guide for Purchase Requisition System

This guide will help you set up Nginx as a reverse proxy to access your Purchase Requisition System on standard port 80.

## Prerequisites

- Your Node.js application running on port 3001
- Windows Administrator access
- Internet connection for downloading Nginx

---

## Step 1: Download and Install Nginx for Windows

### Download Nginx

1. Go to: http://nginx.org/en/download.html
2. Download the **Stable version** for Windows (e.g., `nginx-1.24.0.zip`)
3. Extract the ZIP file to `C:\nginx`

Your folder structure should look like:
```
C:\nginx\
├── conf/
├── html/
├── logs/
├── nginx.exe
└── ...
```

---

## Step 2: Configure Nginx

### Option A: Use the Provided Configuration

1. **Copy the configuration file** from this project:
   - Source: `C:\Projects\purchase-requisition-system\nginx.conf`
   - Destination: `C:\nginx\conf\nginx.conf`

2. **Backup the original** (optional):
   ```bash
   copy C:\nginx\conf\nginx.conf C:\nginx\conf\nginx.conf.backup
   ```

3. **Replace with our configuration**:
   ```bash
   copy C:\Projects\purchase-requisition-system\nginx.conf C:\nginx\conf\nginx.conf
   ```

### Option B: Manual Configuration

If you prefer to manually edit:

1. Open `C:\nginx\conf\nginx.conf` in a text editor (Notepad, VS Code, etc.)
2. Replace the entire contents with the configuration from `nginx.conf` in this project folder

---

## Step 3: Update CORS Settings in Your Application

Update your `.env` file to allow requests from port 80:

```env
ALLOWED_ORIGINS=http://localhost:3001,http://localhost,http://ZMKTCMW002,http://192.168.5.249
```

**Note**: Add all variations of your server name/IP without the port number.

---

## Step 4: Start Nginx

### Method 1: Command Line (Recommended for Testing)

1. **Open Command Prompt as Administrator**:
   - Press `Win + X`
   - Select "Command Prompt (Admin)" or "Windows PowerShell (Admin)"

2. **Navigate to Nginx directory**:
   ```bash
   cd C:\nginx
   ```

3. **Start Nginx**:
   ```bash
   start nginx
   ```

4. **Verify it's running**:
   ```bash
   tasklist /fi "imagename eq nginx.exe"
   ```

   You should see two nginx.exe processes (master and worker).

### Method 2: Double-Click (Quick Start)

Simply double-click `nginx.exe` in `C:\nginx` folder.

---

## Step 5: Start Your Node.js Application

1. **Open a new Command Prompt** (no admin needed):
   ```bash
   cd C:\Projects\purchase-requisition-system\backend
   npm start
   ```

2. **Verify it's running** on port 3001:
   - You should see: "Server running on port 3001"

---

## Step 6: Test the Setup

### Test from Local Machine

Open a browser and navigate to:
- `http://localhost` (should show your application)
- `http://localhost/api/health` (if you have a health endpoint)

### Test from Network Computers

From another computer on your network:
- `http://ZMKTCMW002` (replace with your computer name)
- `http://192.168.5.249` (replace with your IP address)

---

## Step 7: Configure Windows Firewall

If other computers can't access your application:

### Allow Port 80 Through Firewall

Run PowerShell as Administrator:

```powershell
# Allow HTTP (port 80)
netsh advfirewall firewall add rule name="Nginx HTTP" dir=in action=allow protocol=TCP localport=80

# Allow HTTPS (port 443) - for future SSL setup
netsh advfirewall firewall add rule name="Nginx HTTPS" dir=in action=allow protocol=TCP localport=443
```

---

## Managing Nginx

### Stop Nginx

```bash
cd C:\nginx
nginx.exe -s stop
```

### Reload Configuration (after changes)

```bash
cd C:\nginx
nginx.exe -s reload
```

### Test Configuration (before reloading)

```bash
cd C:\nginx
nginx.exe -t
```

### Check if Nginx is Running

```bash
tasklist /fi "imagename eq nginx.exe"
```

---

## Auto-Start on Windows Boot (Optional)

### Create a Startup Script

1. **Create** `start-purchase-requisition-system.bat` in `C:\nginx`:

```batch
@echo off
echo Starting Purchase Requisition System...

REM Start Nginx
cd C:\nginx
start nginx.exe

REM Wait a moment
timeout /t 2 /nobreak > nul

REM Start Node.js Backend
cd C:\Projects\purchase-requisition-system\backend
start /min cmd /c "npm start"

echo System started!
echo Access at: http://localhost
pause
```

2. **Add to Startup Folder**:
   - Press `Win + R`
   - Type: `shell:startup`
   - Create a shortcut to the `.bat` file in the startup folder

### Or Use NSSM (Non-Sucking Service Manager)

For production, consider using NSSM to run both Nginx and Node.js as Windows services:

1. Download NSSM: https://nssm.cc/download
2. Install Nginx as service:
   ```bash
   nssm install nginx C:\nginx\nginx.exe
   nssm start nginx
   ```
3. Install Node.js app as service:
   ```bash
   nssm install purchase-requisition-backend "C:\Program Files\nodejs\node.exe" "C:\Projects\purchase-requisition-system\backend\server.js"
   nssm start purchase-requisition-backend
   ```

---

## Troubleshooting

### Problem: "Address already in use" error

**Solution**: Another application is using port 80 (possibly IIS or Apache)

1. Check what's using port 80:
   ```bash
   netstat -ano | findstr :80
   ```

2. Stop the conflicting service:
   - For IIS: `iisreset /stop`
   - For Apache: Stop Apache service

### Problem: Nginx won't start

**Solution**: Check the error log

1. Open: `C:\nginx\logs\error.log`
2. Look for configuration errors
3. Test configuration: `nginx.exe -t`

### Problem: 502 Bad Gateway

**Solution**: Node.js backend is not running

1. Ensure your Node.js app is running on port 3001
2. Check: `http://localhost:3001` directly
3. Restart backend: `npm start`

### Problem: Can't access from network

**Solution**: Firewall blocking or wrong IP

1. Check firewall rules (see Step 7)
2. Verify your IP address: `ipconfig`
3. Update `server_name` in nginx.conf
4. Update ALLOWED_ORIGINS in .env

### Problem: Changes not reflecting

**Solution**: Browser cache or Nginx cache

1. Clear browser cache (Ctrl + Shift + Delete)
2. Reload Nginx: `nginx.exe -s reload`
3. Hard refresh browser (Ctrl + F5)

---

## Adding HTTPS/SSL (Future Enhancement)

To add HTTPS support:

1. **Get a free SSL certificate** from Let's Encrypt
2. **Update nginx.conf** to listen on port 443
3. **Configure SSL settings** with certificate paths

Example SSL configuration:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     C:/nginx/ssl/certificate.crt;
    ssl_certificate_key C:/nginx/ssl/private.key;

    # Rest of configuration...
}
```

---

## Summary

After completing this setup:

✅ Your application runs on port 3001 (backend)
✅ Nginx listens on port 80 (standard HTTP)
✅ Users access via: `http://localhost` or `http://your-computer-name`
✅ No admin privileges needed to run Node.js
✅ Professional production-ready setup
✅ Ready for SSL/HTTPS in the future

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Start Nginx | `cd C:\nginx && start nginx` |
| Stop Nginx | `nginx.exe -s stop` |
| Reload Nginx | `nginx.exe -s reload` |
| Test Config | `nginx.exe -t` |
| View Logs | `type C:\nginx\logs\error.log` |
| Check Running | `tasklist /fi "imagename eq nginx.exe"` |
| Start Backend | `cd backend && npm start` |

---

## Support

If you encounter issues not covered in this guide:

1. Check nginx error logs: `C:\nginx\logs\error.log`
2. Check Node.js console output
3. Verify firewall settings
4. Ensure ports 80 and 3001 are not blocked

For more information:
- Nginx Documentation: http://nginx.org/en/docs/
- Nginx Windows Guide: http://nginx.org/en/docs/windows.html
