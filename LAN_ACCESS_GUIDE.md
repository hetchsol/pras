# 🌐 LAN Access Guide - Purchase Requisition System

## Quick Start - Make Application Accessible on LAN

Your application is now configured to be accessible across your Local Area Network (LAN) using the computer name **ZMKTCMW002**.

---

## 🚀 Access Methods

### From Other Computers on the Same Network

Users can access the application using **any** of these URLs:

#### Option 1: Using Computer Name (Recommended)
```
http://ZMKTCMW002:3001
```
**Advantages:**
- Easy to remember
- Doesn't change if IP address changes
- Works across network restarts

#### Option 2: Using IP Address
```
http://YOUR-IP-ADDRESS:3001
```
The server will display the IP address when it starts.

**Note:** IP addresses may change after router restarts or DHCP lease renewals.

---

## 📋 Setup Instructions

### 1. Check Current Configuration ✅

The following has already been configured:

**`.env` file updated:**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://ZMKTCMW002:3001,http://zmktcmw002:3001
```

**Server configured to listen on all network interfaces:**
- Server listens on `0.0.0.0:3001`
- Accessible from any network interface

### 2. Configure Windows Firewall

You need to allow incoming connections on port 3001:

#### Option A: Using Windows Firewall GUI (Easy)

1. Press `Windows + R`, type `wf.msc`, press Enter
2. Click "Inbound Rules" in the left panel
3. Click "New Rule..." in the right panel
4. Select "Port" → Next
5. Select "TCP" and enter port `3001` → Next
6. Select "Allow the connection" → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Name: `Purchase Requisition System` → Finish

#### Option B: Using PowerShell (Quick)

Run PowerShell as Administrator and execute:

```powershell
New-NetFirewallRule -DisplayName "Purchase Requisition System" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

#### Option C: Using Command Prompt (Alternative)

Run Command Prompt as Administrator:

```cmd
netsh advfirewall firewall add rule name="Purchase Requisition System" dir=in action=allow protocol=TCP localport=3001
```

### 3. Restart the Backend Server

Stop and restart the server to apply changes:

```bash
# Stop current server (Ctrl+C in the terminal)
# OR find and kill the process:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Restart server
cd backend
npm start
```

The server will now display all available access URLs:

```
🚀 Server running successfully!

📍 Access the application:
   Local:           http://localhost:3001
   Network (Name):  http://ZMKTCMW002:3001
   Network (IP):    http://192.168.1.100:3001
```

---

## 🖥️ Accessing from Other Computers

### From Windows PC

1. Open any web browser (Chrome, Edge, Firefox)
2. Type one of these URLs:
   - `http://ZMKTCMW002:3001`
   - `http://192.168.1.x:3001` (use actual IP)
3. Bookmark for easy access

### From Mac

1. Open Safari or Chrome
2. Type: `http://ZMKTCMW002:3001`
3. Add to favorites

### From Mobile Device (Phone/Tablet)

1. Connect to same WiFi network
2. Open browser
3. Type: `http://ZMKTCMW002:3001` or IP address
4. Add to home screen for quick access

---

## 🔍 Troubleshooting

### Issue 1: "This site can't be reached"

**Possible causes:**
1. Firewall blocking port 3001
2. Server not running
3. Wrong computer name or IP

**Solutions:**
```bash
# 1. Check if server is running
netstat -ano | findstr :3001

# 2. Verify firewall rule exists
netsh advfirewall firewall show rule name="Purchase Requisition System"

# 3. Test from server computer first
# Open browser and go to: http://localhost:3001
# Then try: http://ZMKTCMW002:3001
```

### Issue 2: CORS Error

**Error message:** "Access blocked by CORS policy"

**Solution:** Ensure the origin is in `.env` file:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://ZMKTCMW002:3001,http://zmktcmw002:3001
```

If using IP address, add it too:
```env
ALLOWED_ORIGINS=http://localhost:3001,http://ZMKTCMW002:3001,http://192.168.1.100:3001
```

Restart server after changing `.env`.

### Issue 3: Computer Name Not Resolving

**Symptoms:** Computer name doesn't work, but IP does

**Solutions:**

1. **Try lowercase:** `http://zmktcmw002:3001`
2. **Try FQDN:** `http://ZMKTCMW002.local:3001`
3. **Use IP address instead**
4. **Check network discovery:**
   - Open Control Panel → Network and Sharing Center
   - Change advanced sharing settings
   - Turn on network discovery
   - Turn on file and printer sharing

### Issue 4: Connection Times Out

**Check network connectivity:**
```bash
# From client computer, ping the server:
ping ZMKTCMW002

# Check if port is reachable (from client):
telnet ZMKTCMW002 3001
# OR using PowerShell:
Test-NetConnection -ComputerName ZMKTCMW002 -Port 3001
```

### Issue 5: Different Subnets

If computers are on different subnets, you may need:
- Network routing configured
- VPN connection
- Same VLAN access

---

## 🔒 Security Considerations

### For Office/Internal Network (Current Setup)

✅ **Good for:**
- Small office networks
- Trusted users only
- Same physical location
- Behind company firewall

### Additional Security for Production

If exposing to larger networks, consider:

1. **HTTPS/SSL:**
   ```bash
   # Use reverse proxy (Nginx) with SSL certificate
   # See DEPLOYMENT.md for details
   ```

2. **VPN Access:**
   - Require VPN connection to access application
   - Adds encryption layer

3. **Network Isolation:**
   - Place on separate VLAN
   - Restrict access by IP range

4. **Strong Passwords:**
   - Enforce password policies
   - Change default credentials immediately

---

## 📱 Create Desktop Shortcuts

### For Windows Users

Create a shortcut on desktop:

1. Right-click Desktop → New → Shortcut
2. Location: `http://ZMKTCMW002:3001`
3. Name: `Purchase Requisition System`
4. Click Finish

### For Browser Bookmarks

**Chrome/Edge:**
1. Visit `http://ZMKTCMW002:3001`
2. Click star icon in address bar
3. Save to bookmarks bar

---

## 🌐 Static IP Configuration (Optional)

To prevent IP address changes:

### On Windows Server Computer

1. Open Network Connections
2. Right-click network adapter → Properties
3. Select "Internet Protocol Version 4 (TCP/IPv4)"
4. Click Properties
5. Select "Use the following IP address"
6. Enter:
   - IP address: `192.168.1.100` (or available IP)
   - Subnet mask: `255.255.255.0`
   - Default gateway: `192.168.1.1` (your router)
   - DNS: `8.8.8.8` or your network DNS

7. Click OK

### Or Configure DHCP Reservation on Router

1. Log into your router (usually `192.168.1.1`)
2. Find DHCP settings
3. Add reservation for MAC address of server
4. Assign static IP (e.g., `192.168.1.100`)

---

## 📊 Monitoring Access

### View Connected Clients

Check server logs for connections:
```bash
# In backend directory
# Logs show incoming requests with IP addresses
```

### Network Activity

```bash
# Windows: View active connections
netstat -an | findstr :3001

# See who's connected
netstat -an | findstr :3001 | findstr ESTABLISHED
```

---

## 🎯 Quick Reference

| Access Method | URL | When to Use |
|---------------|-----|-------------|
| Local (Same PC) | `http://localhost:3001` | Testing on server |
| Computer Name | `http://ZMKTCMW002:3001` | Other PCs on LAN |
| IP Address | `http://192.168.1.x:3001` | Backup method |

### Port Information
- **Application Port:** 3001
- **Protocol:** HTTP
- **Firewall:** Must allow TCP 3001 inbound

---

## 📝 Checklist for LAN Access

- [ ] `.env` file updated with computer name
- [ ] Windows Firewall rule created for port 3001
- [ ] Server restarted
- [ ] Tested from server: `http://localhost:3001` ✓
- [ ] Tested from server: `http://ZMKTCMW002:3001`
- [ ] Tested from another PC on network
- [ ] Bookmarks created for users
- [ ] Default passwords changed

---

## 🔄 When Server Computer Restarts

The application will not start automatically. You need to:

### Option 1: Manual Start
```bash
cd C:\Projects\purchase-requisition-system\backend
npm start
```

### Option 2: Auto-Start (Windows Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Start Purchase Requisition System"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program: `node`
7. Arguments: `C:\Projects\purchase-requisition-system\backend\server.js`
8. Start in: `C:\Projects\purchase-requisition-system\backend`

### Option 3: Windows Service

See DEPLOYMENT.md for instructions on setting up as a Windows service.

---

## 💡 Tips

1. **Bookmark the URL** on all client computers
2. **Print access instructions** for users
3. **Use computer name** instead of IP (more stable)
4. **Test before** sharing with users
5. **Keep server computer** powered on and connected

---

## 📞 Support

If you encounter issues:

1. **Check server is running:**
   ```bash
   netstat -ano | findstr :3001
   ```

2. **Verify firewall:**
   ```bash
   netsh advfirewall firewall show rule name="Purchase Requisition System"
   ```

3. **Test locally first:**
   - Visit `http://localhost:3001`
   - Then try `http://ZMKTCMW002:3001`

4. **Check network connectivity:**
   ```bash
   ping ZMKTCMW002
   ```

---

**Your application is now accessible on the LAN!** 🎉

Users can access it at: **`http://ZMKTCMW002:3001`**

---

**Last Updated:** October 31, 2025
**Server:** ZMKTCMW002
**Port:** 3001
