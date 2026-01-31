# Role Normalization Fix

**Date:** December 1, 2025
**Issue:** EFT requisition not appearing for Anne Banda (Finance Manager)

---

## Problem Identified

Anne Banda's role in the database was set to `"finance manager"` (with space) but the backend authorization middleware expects the role to be exactly `"finance"`.

### Root Cause
When users were synchronized from the Excel spreadsheet `Users_Depts (1).xlsx`, the script imported roles exactly as they appeared in the spreadsheet. Anne Banda's role was listed as "Finance Manager", which was converted to lowercase `"finance manager"`.

The backend authorization checks in `backend/routes/forms.js` use:
```javascript
authorize('finance', 'admin')
```

This check uses exact string matching, so `"finance manager"` did not match `"finance"`, causing authorization failures.

---

## Solution Applied

### 1. Immediate Fix
Updated Anne Banda's role in the database:

```javascript
UPDATE users SET role = 'finance' WHERE username = 'anne.banda'
```

**Result:**
- Before: `{ username: 'anne.banda', role: 'finance manager' }`
- After: `{ username: 'anne.banda', role: 'finance' }`

### 2. Script Update
Updated `backend/scripts/updateUsersFromSpreadsheet.js` to normalize role names:

```javascript
// Normalize role (convert supervisor to hod, finance manager to finance)
if (role === 'supervisor') {
    role = 'hod';
}
if (role === 'finance manager') {
    role = 'finance';
}
```

This ensures future spreadsheet imports will automatically normalize the role.

---

## Verified EFT Pending Approval

After the fix, confirmed that the pending EFT is now accessible:

```
ID: KSB-EFT-20251201190010
Status: pending_finance
Initiator: Justine Kaluya
Amount: ZMW 12,345.67
Purpose: Ndola trip
Created: 2025-12-01 17:00:10
```

---

## Standard Role Names

For consistency across the system, use these exact role names:

| Spreadsheet Role | Database Role |
|------------------|---------------|
| Initiator        | `initiator`   |
| HOD              | `hod`         |
| Supervisor       | `hod`         |
| Finance Manager  | `finance`     |
| Procurement      | `procurement` |
| MD               | `md`          |
| Admin            | `admin`       |

---

## Testing

✅ Anne Banda role updated successfully
✅ Pending EFT requisition verified in database
✅ Script updated to prevent future issues
✅ No other finance-related role mismatches found

---

## Files Modified

1. **Database**: `backend/purchase_requisition.db`
   - Updated `users` table, `anne.banda` role

2. **Script**: `backend/scripts/updateUsersFromSpreadsheet.js`
   - Added role normalization for "finance manager" → "finance"

---

**Status:** ✅ RESOLVED
**Impact:** Anne Banda can now approve EFT requisitions
