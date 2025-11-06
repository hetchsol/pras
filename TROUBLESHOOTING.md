# Troubleshooting Guide - Purchase Requisition System

## Problem: Blank Screen After Login

If you encounter a blank screen after logging in, follow these steps:

### Quick Fix (Recommended)
1. **Hard Refresh**: Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. **Clear Browser Cache**:
   - Open Developer Tools: Press `F12`
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"
3. **Try Incognito/Private Mode**: Open the app in a private/incognito window

### Permanent Solution

The system now has **automatic cache clearing** built-in (Version 5.0.0+). Every time you load the page:
- All service workers are unregistered
- All cache storage is cleared
- Old localStorage entries are removed
- Version checking ensures fresh code

### If Problem Persists

1. **Check Browser Console**:
   - Press `F12` to open Developer Tools
   - Click on the "Console" tab
   - Look for error messages (red text)
   - The console will show helpful diagnostic messages:
     - ✓ = Success (green checkmark)
     - ❌ = Error (red X)
     - ⚠️ = Warning (yellow warning)

2. **Verify Backend is Running**:
   ```bash
   # The backend should be running on port 3001
   # Check if you see this message:
   🚀 Server running on http://localhost:3001
   ```

3. **Check Network Tab**:
   - In Developer Tools, click "Network" tab
   - Refresh the page
   - Verify that `app.js` loads successfully (should show status 200)

4. **Manual Cache Clear**:
   - In Developer Tools, go to "Application" tab (Chrome) or "Storage" tab (Firefox)
   - Under "Storage", click "Clear site data"
   - Check all boxes and click "Clear"
   - Reload the page

### Error Messages Explained

#### "React Failed to Load"
- **Cause**: Internet connection issue or CDN is blocked
- **Fix**: Check your internet connection, try a different network

#### "Application Failed to Load"
- **Cause**: app.js file couldn't load or has a syntax error
- **Fix**:
  1. Verify backend server is running
  2. Check browser console for JavaScript errors
  3. Ensure `C:\Projects\purchase-requisition-system\frontend\app.js` exists

#### "Application Error" with stack trace
- **Cause**: Runtime JavaScript error in the application
- **Fix**: Take a screenshot of the error and check the file/line number mentioned

### System Architecture

The application consists of:
- **index.html**: Entry point with cache clearing and error handling
- **app.js**: Main application code with all components (Sidebar, TopBar, etc.)
- **Backend**: Node.js server on port 3001

### Version Information

Current Version: **5.0.0**

Features:
- ✅ Automatic cache clearing
- ✅ Left sidebar navigation
- ✅ Budget management (Finance/MD/Admin)
- ✅ FX Rates management (Finance/Procurement/Admin)
- ✅ Complete error diagnostics
- ✅ Loading state indicators

### Contact Support

If none of these solutions work:
1. Open browser Developer Tools (F12)
2. Copy all console messages
3. Copy any error messages displayed on screen
4. Report the issue with these details

### Advanced: Complete Reset

To completely reset the application state:

```javascript
// Run this in browser console (F12 > Console tab)
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

This will log you out and clear all stored data.
