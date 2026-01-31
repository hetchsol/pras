# Cross-Subnet Access Configuration Guide
## Purchase Requisition System

This guide explains how to access the Purchase Requisition System from different subnets.

---

## Network Configuration

### Server Location
- **Server Name**: PRAS
- **Server IP**: 10.96.32.87
- **Server Subnet**: 10.96.32.0/24

### Client Location
- **Client Subnet**: 10.96.33.0/24
- **Access Required**: Users on 10.96.33.x need to access server on 10.96.32.87

---

## Configuration Steps

### Step 1: Configure Firewall (One-Time Setup)

**Run as Administrator on the server (PRAS):**

```bash
configure-cross-subnet-access.bat
```

This script:
- Adds firewall rule to allow HTTP (port 80) from 10.96.33.0/24
- Adds firewall rule to allow Backend (port 3001) from 10.96.33.0/24
- Displays current firewall configuration

**Manual firewall configuration** (if needed):

```powershell
# Run as Administrator
netsh advfirewall firewall add rule name="Purchase Requisition - HTTP 10.96.33.x" dir=in action=allow protocol=TCP localport=80 remoteip=10.96.33.0/24

netsh advfirewall firewall add rule name="Purchase Requisition - Backend 10.96.33.x" dir=in action=allow protocol=TCP localport=3001 remoteip=10.96.33.0/24
```

---

### Step 2: Restart Backend Service

After updating configuration, restart the backend to apply CORS changes:

**Option A - If using services:**
```bash
restart-services.bat
```

**Option B - Manual restart:**
```bash
# Stop current backend (Ctrl+C if running in terminal)
# Then start again:
cd C:\Projects\purchase-requisition-system\backend
npm start
```

---

### Step 3: Reload Nginx Configuration

Nginx configuration has been updated to accept requests from 10.96.32.87.

**Reload Nginx:**
```powershell
cd "C:\Users\Purchase Requisition\Downloads\nginx-1.28.0\nginx-1.28.0"
.\nginx.exe -s reload
```

---

## Testing Cross-Subnet Access

### From the Server (PRAS - 10.96.32.87)

**Run the test script:**
```bash
test-cross-subnet-access.bat
```

This verifies:
- Current IP address matches 10.96.32.87
- Backend is running on port 3001
- Nginx is running on port 80
- Firewall rules are configured

---

### From Client Computer (10.96.33.x)

#### Test 1: Network Connectivity

**Open Command Prompt and test ping:**
```bash
ping 10.96.32.87
```

**Expected result:**
```
Reply from 10.96.32.87: bytes=32 time<10ms TTL=128
```

**If ping fails:**
- Check if both computers are on correct subnets
- Verify network routing between 10.96.32.x and 10.96.33.x
- Contact network administrator to enable routing

#### Test 2: HTTP Access

**Open web browser and navigate to:**
```
http://10.96.32.87
```

**Expected result:**
- Purchase Requisition System login page appears

**Alternative URLs to try:**
```
http://PRAS
http://pras
```

#### Test 3: Command Line HTTP Test

```bash
curl http://10.96.32.87
```

**Expected result:**
- HTML content of the application

---

## Access URLs

### From Server (10.96.32.87)
```
http://localhost
http://127.0.0.1
http://10.96.32.87
```

### From Same Subnet (10.96.32.x)
```
http://10.96.32.87
http://PRAS
http://pras
```

### From Different Subnet (10.96.33.x)
```
http://10.96.32.87
http://PRAS (if DNS resolution works)
http://pras (if DNS resolution works)
```

**Recommended:** Use IP address (http://10.96.32.87) for reliability

---

## Network Requirements

### Router/Gateway Configuration

For cross-subnet communication to work, your network infrastructure must allow:

1. **Routing between subnets**
   - 10.96.32.0/24 ↔ 10.96.33.0/24
   - Usually configured on the router/gateway

2. **No firewall blocking between subnets**
   - Enterprise firewalls may block inter-subnet traffic
   - Check with network administrator

### Verify Routing

**From client on 10.96.33.x:**
```bash
# Check route to 10.96.32.87
tracert 10.96.32.87
```

**Expected result:**
```
Tracing route to 10.96.32.87
  1    <1 ms   <1 ms   <1 ms  10.96.33.1 (gateway)
  2    <1 ms   <1 ms   <1 ms  10.96.32.87
```

If you see more hops or "Request timed out", routing may not be configured.

---

## Troubleshooting

### Problem: Ping works but browser shows "Unable to connect"

**Cause:** Firewall blocking HTTP traffic

**Solution:**
1. On server (PRAS), run as Administrator:
   ```bash
   configure-cross-subnet-access.bat
   ```

2. Verify firewall rules:
   ```bash
   netsh advfirewall firewall show rule name="Purchase Requisition - HTTP 10.96.33.x"
   ```

3. Temporarily disable Windows Firewall to test (re-enable after!):
   ```bash
   netsh advfirewall set allprofiles state off
   ```
   If this works, the issue is firewall configuration.

---

### Problem: "CORS policy blocked" error in browser

**Cause:** Backend not allowing requests from client IP

**Solution:**
1. Verify `.env` file has updated ALLOWED_ORIGINS
2. Restart backend service
3. Check backend logs for CORS errors

---

### Problem: Ping fails completely

**Cause:** No routing between subnets or network firewall

**Solution:**
1. Verify client is on 10.96.33.x:
   ```bash
   ipconfig
   ```

2. Verify server is on 10.96.32.87:
   ```bash
   ipconfig
   ```

3. Contact network administrator to:
   - Enable routing between 10.96.32.0/24 and 10.96.33.0/24
   - Disable inter-subnet firewall blocking
   - Verify VLAN configuration allows communication

---

### Problem: Works from some 10.96.33.x IPs but not others

**Cause:** Individual computer firewalls or network policies

**Solution:**
1. Check client computer's firewall
2. Try from a different computer on 10.96.33.x
3. Verify no proxy server interfering

---

## Configuration Files Updated

The following files have been updated for cross-subnet access:

### 1. Backend CORS Configuration
**File:** `C:\Projects\purchase-requisition-system\backend\.env`

**Line 14-15:**
```env
# Allows access from localhost, computer name, and both subnets (10.96.32.x and 10.96.33.x)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost,http://ZMKTCMW002,http://zmktcmw002,http://PRAS,http://pras,http://10.96.32.87,http://10.96.32.87:3001,http://192.168.23.114,http://192.168.5.249
```

### 2. Nginx Server Names
**File:** `C:\Users\Purchase Requisition\Downloads\nginx-1.28.0\nginx-1.28.0\conf\nginx.conf`

**Line 28-30:**
```nginx
# Replace with your computer name or IP address
# Updated to support cross-subnet access (10.96.32.x and 10.96.33.x)
server_name localhost ZMKTCMW002 zmktcmw002 PRAS pras 10.96.32.87 192.168.23.114 192.168.5.249;
```

---

## Scripts Created

### configure-cross-subnet-access.bat
- Configures Windows Firewall rules
- Allows traffic from 10.96.33.0/24 subnet
- **Run as Administrator**

### test-cross-subnet-access.bat
- Tests network configuration
- Verifies services are running
- Checks firewall rules
- Provides troubleshooting information

---

## Security Considerations

### Firewall Rules

The firewall rules created only allow:
- Incoming HTTP (port 80) from 10.96.33.0/24
- Incoming Backend (port 3001) from 10.96.33.0/24

**NOT allowed:**
- Access from other subnets (unless explicitly added)
- Access from internet (unless routed through gateway)
- Outbound connections are not affected

### CORS Security

CORS is configured to accept requests from:
- localhost (development)
- Server IP addresses (10.96.32.87, 192.168.23.114, 192.168.5.249)
- Computer names (PRAS, ZMKTCMW002)

**NOT allowed:**
- Arbitrary external domains
- Cross-origin requests from unlisted sources

---

## Production Recommendations

For production deployment with cross-subnet access:

1. **Use HTTPS instead of HTTP**
   - Obtain SSL certificate
   - Configure Nginx for port 443
   - Force HTTPS redirection

2. **Use DNS instead of IP addresses**
   - Register internal DNS name (e.g., purchasereqs.company.local)
   - Point to 10.96.32.87
   - Users access via http://purchasereqs.company.local

3. **Implement VPN for remote access**
   - Use VPN for access from outside the building
   - More secure than exposing to internet

4. **Monitor access logs**
   - Review Nginx access logs regularly
   - Check for unauthorized access attempts

5. **Regular backups**
   - Use automated backup scripts provided
   - Store backups on different subnet or server

---

## Quick Reference

### Server Information
```
Server Name: PRAS
Server IP: 10.96.32.87
Server Subnet: 10.96.32.0/24
HTTP Port: 80
Backend Port: 3001
```

### Client Access
```
From 10.96.33.x: http://10.96.32.87
Ping Test: ping 10.96.32.87
```

### Scripts
```
Configure: configure-cross-subnet-access.bat (as Admin)
Test: test-cross-subnet-access.bat
Restart: restart-services.bat (as Admin)
```

### Troubleshooting Commands
```
# Check firewall rules
netsh advfirewall firewall show rule name=all | findstr "Purchase"

# Test connectivity
ping 10.96.32.87
tracert 10.96.32.87
curl http://10.96.32.87

# Check services
check-services.bat
```

---

## Support

If you encounter issues not covered in this guide:

1. Run `test-cross-subnet-access.bat` and review output
2. Check firewall rules are configured
3. Verify backend service is running
4. Test network connectivity with ping
5. Contact network administrator for routing issues

---

**Last Updated:** 2025-01-25
**Server IP:** 10.96.32.87
**Client Subnet:** 10.96.33.0/24
