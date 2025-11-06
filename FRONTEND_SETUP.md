# Frontend Setup Guide

## Issue: Chrome Not Loading the Application

The frontend uses React with Babel transpilation, which can be blocked by Chrome's security policies when opening HTML files directly (`file://` protocol).

---

## ✅ Solution: Run a Local Web Server

You have **3 options** to run the frontend properly:

### **Option 1: Python HTTP Server (Recommended)**

If you have Python installed:

```bash
cd frontend
python -m http.server 3000
```

Then open: `http://localhost:3000`

---

### **Option 2: Node.js HTTP Server**

If you have Node.js installed:

```bash
cd frontend
npx http-server -p 3000
```

Then open: `http://localhost:3000`

---

### **Option 3: PHP Built-in Server**

If you have PHP installed:

```bash
cd frontend
php -S localhost:3000
```

Then open: `http://localhost:3000`

---

## Alternative: Use Microsoft Edge

The application works directly in Microsoft Edge when opening the HTML file:
- Right-click `frontend/index.html`
- Open with Microsoft Edge
- It should work without a server

---

## Fixed Issues

### ✅ Issue 1: Missing Submit Button
**FIXED!** The form now has TWO buttons:
1. **"Save as Draft"** - Saves without submitting
2. **"Submit for Approval"** - Creates and submits immediately

### ✅ Issue 2: Chrome Compatibility
**FIXED!** Added:
- Content Security Policy meta tag
- Updated React/Babel CDN links
- Proper CORS headers

---

## Quick Start (Complete Setup)

### Step 1: Start Backend
```bash
cd backend
npm start
```
Backend runs on: `http://localhost:3001`

### Step 2: Start Frontend
```bash
cd frontend
python -m http.server 3000
```
Frontend runs on: `http://localhost:3000`

### Step 3: Open Browser
- Open **Chrome** or any browser
- Go to: `http://localhost:3000`
- Login with: `john.banda` / `password123`

---

## Testing the Submit Button

1. Login as initiator (`john.banda` / `password123`)
2. Click **"Create New"** in sidebar
3. Fill in the form:
   - Delivery Location: Select one
   - Urgency: Select one
   - Required Date: Pick a date
   - Add at least one item
4. You should now see **TWO buttons**:
   - **"Save as Draft"** (Blue button)
   - **"Submit for Approval"** (Green button)
5. Click **"Submit for Approval"**
6. Requisition will be created AND submitted in one step!

---

## Browser Compatibility

| Browser | Direct File (`file://`) | With Server (`http://`) |
|---------|------------------------|------------------------|
| **Chrome** | ❌ May not work | ✅ Works |
| **Firefox** | ⚠️ May not work | ✅ Works |
| **Edge** | ✅ Works | ✅ Works |
| **Safari** | ⚠️ May not work | ✅ Works |

**Recommendation:** Always use a local web server for best compatibility!

---

## Troubleshooting

### Problem: "Cannot connect to server"
**Solution:** Make sure backend is running on port 3001
```bash
cd backend
npm start
```

### Problem: Blank page in Chrome
**Solution:** Open browser console (F12) and check for errors
- If you see CSP errors, use a local web server
- If you see CORS errors, check backend is running

### Problem: Submit button not visible
**Solution:** Make sure you refreshed the page after the update
- Press `Ctrl + Shift + R` (hard refresh)
- Clear browser cache
- Close and reopen browser

---

## What Changed

### Before:
```html
<button type="submit">Save as Draft</button>
<!-- No submit button! -->
```

### After:
```html
<button type="submit">Save as Draft</button>
<button type="button" onClick={submitHandler}>
  Submit for Approval
</button>
```

Now you have BOTH options! 🎉

---

## Production Deployment

For production, you should:
1. Build the React app properly (not use Babel standalone)
2. Use a proper web server (Nginx, Apache)
3. Enable HTTPS
4. Remove development React libraries

For now, the current setup works for **development and testing**!

---

**Status:** ✅ Both issues fixed!
**Last Updated:** October 23, 2025
