# Expense Claims Table Migration

**Date:** December 2, 2025
**Issue:** Table schema mismatch causing "column not found" errors
**Status:** ✅ FULLY RESOLVED (Both tables migrated)

---

## Problem

The `expense_claims` table had an outdated schema that didn't match the travel expense claim form requirements. The table was using simple columns like:
- `claimant_name`
- `period_from`
- `period_to`
- `total_amount`

But the application code expected travel expense claim columns:
- `employee_name`
- `employee_number`
- `reason_for_trip`
- `total_kilometers`, `km_rate`, `sub_total`, etc.

This caused errors when users tried to submit expense claims:
```
Error: table expense_claims has no column named employee_name
```

---

## Solution

Created and executed a migration script that:

1. **Backed up the old table** as `expense_claims_old`
2. **Created new table** with correct travel expense claim schema
3. **Migrated existing data** (if any) from old to new schema
4. **Preserved old table** for safety

---

## Migration Scripts

### 1. Comprehensive Migration (Recommended)
**File:** `backend/scripts/migrateAllTables.js`

This script checks and migrates ALL tables in the database:
- `expense_claims` - Main expense claim table
- `expense_claim_items` - Line items for expense claims
- `users` - Ensures employee_number and full_name columns exist
- `form_approvals` - Ensures approver_role, approver_id, approver_name columns exist

```bash
cd backend
node scripts/migrateAllTables.js
```

### 2. Individual Migration Scripts
**Files:**
- `backend/scripts/migrateExpenseClaimsTable.js` - Expense claims only
- `backend/scripts/migrateExpenseClaimItemsTable.js` - Expense claim items only

### What they do:
1. Check current table structure
2. Detect if migration is needed
3. Rename old table to `tablename_old`
4. Create new table with correct schema
5. Migrate any existing data
6. Report success/failure

---

## New Table Schemas

### expense_claims
```sql
CREATE TABLE expense_claims (
  id TEXT PRIMARY KEY,
  employee_name TEXT NOT NULL,
  employee_number TEXT NOT NULL,
  department TEXT NOT NULL,
  reason_for_trip TEXT NOT NULL,
  total_kilometers REAL DEFAULT 0,
  km_rate REAL DEFAULT 0,
  sub_total REAL DEFAULT 0,
  total_travel REAL DEFAULT 0,
  total_claim REAL DEFAULT 0,
  amount_advanced REAL DEFAULT 0,
  amount_due REAL DEFAULT 0,
  initiator_id INTEGER NOT NULL,
  initiator_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiator_id) REFERENCES users(id)
);
```

### expense_claim_items
```sql
CREATE TABLE expense_claim_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id TEXT NOT NULL,
  report_no INTEGER NOT NULL,
  date TEXT NOT NULL,
  details TEXT NOT NULL,
  km REAL DEFAULT 0,
  breakfast INTEGER DEFAULT 0,
  lunch INTEGER DEFAULT 0,
  dinner INTEGER DEFAULT 0,
  meals REAL DEFAULT 0,
  accommodation REAL DEFAULT 0,
  sundries_phone REAL DEFAULT 0,
  total_zmw REAL DEFAULT 0,
  FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE
);
```

---

## Verification

After migration:

```bash
# Check new table structure
cd backend
node -e "const db = require('better-sqlite3')('purchase_requisition.db'); console.log(db.prepare('PRAGMA table_info(expense_claims)').all());"
```

Expected columns:
- ✅ id
- ✅ employee_name
- ✅ employee_number
- ✅ department
- ✅ reason_for_trip
- ✅ total_kilometers
- ✅ km_rate
- ✅ sub_total
- ✅ total_travel
- ✅ total_claim
- ✅ amount_advanced
- ✅ amount_due
- ✅ initiator_id
- ✅ initiator_name
- ✅ status
- ✅ created_at

---

## Clean Up (Optional)

Once you've verified everything works correctly, you can drop the old backup table:

```sql
-- Connect to database
sqlite3 backend/purchase_requisition.db

-- Drop old table
DROP TABLE expense_claims_old;

-- Exit
.quit
```

---

## Impact

**Before Migration:**
- ❌ Expense claim form couldn't submit
- ❌ "column not found" errors

**After Migration:**
- ✅ Expense claim form works correctly
- ✅ All fields auto-populate (employee_name, employee_number, department)
- ✅ Travel expense details can be added
- ✅ Regional routing works as expected

---

## Related Features

This migration enables:
1. Travel expense claim submission
2. Auto-population of employee details
3. Department-based regional routing
4. Kilometer-based travel calculations
5. Advance and amount due tracking

---

**Migration Date:** December 2, 2025
**Status:** 🟢 Complete
**Data Loss:** ❌ None (old table preserved)
**Downtime:** ⚡ None required
