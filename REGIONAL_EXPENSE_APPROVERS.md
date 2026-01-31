# Regional Expense Claim Approvers

**Date:** December 2, 2025
**Status:** ✅ FULLY IMPLEMENTED
**Scope:** EXPENSE CLAIMS ONLY

---

## Overview

Implemented department-based routing for Expense Claims, where specific regional accountants approve claims from their respective regions before MD approval. This functionality is **ONLY** for Expense Claims - EFT Requisitions and Purchase Requisitions continue to use the standard Finance Manager → MD workflow.

---

## 🎯 Key Features

### 1. **Regional Approver Assignment**
- **Nashon Nguni** (nashon.nguni): Approves expense claims from **Solwezi** and **Operations** departments
- **Mwansa Mwelwa** (mwelwa.mwansa): Approves expense claims from **Lusaka** department

### 2. **Dual Role Functionality**
- Regional approvers maintain their **"initiator"** role
- They can both:
  - Submit their own expense claims
  - Approve claims from their assigned departments

### 3. **Department-Based Routing**
When an expense claim is submitted:
- **Solwezi/Operations departments** → Routes to Nashon Nguni → MD
- **Lusaka department** → Routes to Mwansa Mwelwa → MD
- **Other departments** → Routes to Finance Manager → MD (legacy workflow)

### 4. **New Status Flow**
**Regional Route:**
1. `draft` → User creates claim
2. `pending_regional` → Awaiting regional approver (Nashon/Mwansa)
3. `regional_approved` → Regional approver approved
4. `approved` → MD approved (final)

**Finance Route (for departments without regional approvers):**
1. `draft` → User creates claim
2. `pending_finance` → Awaiting Finance Manager
3. `pending_md` → Finance approved, awaiting MD
4. `approved` → MD approved (final)

---

## 📋 Implementation Details

### Database Changes

#### 1. New Table: `regional_expense_approvers`

```sql
CREATE TABLE regional_expense_approvers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  departments TEXT NOT NULL,  -- Comma-separated list
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Current Data:**
| ID | User ID | Username | Full Name | Departments |
|----|---------|----------|-----------|-------------|
| 1 | 41 | nashon.nguni | Nguni Nashon | Solwezi,Operations |
| 2 | 43 | mwelwa.mwansa | Mwansa Mwelwa | Lusaka |

#### 2. New Statuses in `expense_claims` Table
- `pending_regional` - Awaiting regional approver
- `regional_approved` - Approved by regional approver

#### 3. New Approval Role in `form_approvals` Table
- `approver_role = 'regional_finance'` - For regional approver signatures

### Backend Changes

#### File: `backend/database.js`

**New Functions Added:**
```javascript
const getRegionalExpenseApprovers = () => {
  return db.prepare('SELECT * FROM regional_expense_approvers').all();
};

const getRegionalApproverForDepartment = (department) => {
  const approvers = db.prepare('SELECT * FROM regional_expense_approvers').all();
  for (const approver of approvers) {
    const depts = approver.departments.split(',');
    if (depts.includes(department)) {
      return approver;
    }
  }
  return null;
};

const isRegionalExpenseApprover = (userId) => {
  const result = db.prepare('SELECT COUNT(*) as count FROM regional_expense_approvers WHERE user_id = ?')
    .get(userId);
  return result.count > 0;
};
```

#### File: `backend/routes/forms.js`

**1. Updated Expense Claim Submission** (Line 311-326):
```javascript
// Determine routing based on department
const regionalApprover = getRegionalApproverForDepartment(claim.department);
let newStatus;

if (regionalApprover) {
  // Route to regional approver (Nashon for Solwezi/Operations, Mwansa for Lusaka)
  newStatus = 'pending_regional';
  logger.info(`Expense claim submitted to regional approver ${regionalApprover.full_name}: ${req.params.id} from ${claim.department}`);
} else {
  // Route to Finance Manager (for departments without regional approvers)
  newStatus = 'pending_finance';
  logger.info(`Expense claim submitted to Finance Manager: ${req.params.id} from ${claim.department}`);
}

updateExpenseClaimStatus(req.params.id, newStatus);
```

**2. Updated GET Expense Claims Filtering** (Line 55-73):
```javascript
if (userRole === 'initiator') {
  // Check if this initiator is also a regional approver
  const isRegionalApprover = isRegionalExpenseApprover(req.user.id);

  if (isRegionalApprover) {
    // Get their approver info to see which departments they handle
    const approvers = getRegionalExpenseApprovers();
    const myApproverInfo = approvers.find(a => a.user_id === req.user.id);
    const myDepartments = myApproverInfo ? myApproverInfo.departments.split(',') : [];

    // Show: their own claims + claims from their departments pending their approval
    filteredClaims = claims.filter(c =>
      c.initiator_id === req.user.id ||
      (myDepartments.includes(c.department) && c.status === 'pending_regional')
    );
  } else {
    // Regular initiators see only their own claims
    filteredClaims = claims.filter(c => c.initiator_id === req.user.id);
  }
}
```

**3. New Regional Approval Endpoint** (Line 377-425):
```javascript
// Regional approver approve/reject expense claim (Nashon/Mwansa)
router.put('/expense-claims/:id/regional-action', authenticate, authorize('initiator', 'admin'), (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const claim = getExpenseClaimById(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found' });
    }

    if (claim.status !== 'pending_regional') {
      return res.status(400).json({ error: 'Claim is not pending regional approval' });
    }

    // Verify this user is a regional approver for this department
    if (!isRegionalExpenseApprover(req.user.id)) {
      return res.status(403).json({ error: 'User is not a regional expense approver' });
    }

    const regionalApprover = getRegionalApproverForDepartment(claim.department);
    if (!regionalApprover || regionalApprover.user_id !== req.user.id) {
      return res.status(403).json({ error: 'User is not authorized to approve claims from this department' });
    }

    const newStatus = action === 'approve' ? 'regional_approved' : 'rejected';
    updateExpenseClaimStatus(req.params.id, newStatus);

    // Record approval
    createFormApproval({
      form_type: 'expense_claim',
      form_id: req.params.id,
      role: 'regional_finance',
      user_id: req.user.id,
      user_name: req.user.name,
      action,
      comment
    });

    logger.info(`Expense claim ${action}d by Regional Approver: ${req.params.id} by ${req.user.name}`);
    res.json({ message: `Expense claim ${action}d successfully` });
  } catch (error) {
    logger.error('Error processing regional action:', error);
    next(error);
  }
});
```

**4. Updated MD Approval Endpoint** (Line 442-444):
```javascript
// MD can approve claims that are regional_approved OR pending_md (for Finance Manager route)
if (claim.status !== 'regional_approved' && claim.status !== 'pending_md') {
  return res.status(400).json({ error: 'Claim is not ready for MD approval' });
}
```

### Frontend Changes

#### File: `frontend/forms-dashboard.html`

**1. Updated Status Display** (Line 1050-1060):
```javascript
function getStatusText(status) {
    const text = {
        draft: 'Draft',
        pending_finance: 'Pending Finance',
        pending_regional: 'Pending Regional Approval',
        finance_approved: 'Finance Approved',
        regional_approved: 'Regional Approved',
        pending_md: 'Pending MD',
        approved: 'Approved',
        rejected: 'Rejected'
    };
    return text[status] || status;
}
```

**2. Updated Approve Function** (Line 867-877):
```javascript
// Determine endpoint based on claim status and user role
let endpoint;
if (selectedItem.status === 'pending_regional') {
    endpoint = 'regional-action';  // Regional approvers (Nashon/Mwansa)
} else if (selectedItem.status === 'pending_finance') {
    endpoint = 'finance-action';  // Finance Manager
} else if (selectedItem.status === 'regional_approved' || selectedItem.status === 'pending_md') {
    endpoint = 'md-action';  // MD
} else {
    alert('This claim cannot be approved at this stage');
    return;
}
```

**3. Updated Reject Function** (Line 910-920):
Same logic as approve function for determining correct endpoint.

### PDF Generation Changes

#### File: `backend/utils/formsPDFGenerator.js`

**Updated Expense Claim PDF** (Line 242-297):
```javascript
// Find approvals
const financeApproval = approvals.find(a => a.approver_role === 'finance' && a.action === 'approve');
const regionalApproval = approvals.find(a => a.approver_role === 'regional_finance' && a.action === 'approve');
const mdApproval = approvals.find(a => a.approver_role === 'md' && a.action === 'approve');

// Finance Manager / Regional Approver
doc.fontSize(8).font('Helvetica-Bold');
doc.text('FINANCE MANAGER:', 40, currentY);
doc.rect(140, currentY - 2, 180, 25).stroke();

// Show regional approval if present, otherwise finance approval
const approvalToShow = regionalApproval || financeApproval;
if (approvalToShow) {
    doc.fontSize(7).font('Helvetica').fillColor('#0066cc');
    doc.text('Electronically Approved by:', 145, currentY + 1);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
    const approverTitle = regionalApproval ? 'Regional Finance' : 'Finance Manager';
    doc.text(`${approvalToShow.approver_name}/${approverTitle}`, 145, currentY + 9, { width: 170 });
    doc.fontSize(6).font('Helvetica').fillColor('#666666');
    const approvalDate = new Date(approvalToShow.created_at);
    doc.text(`${approvalDate.toLocaleDateString('en-GB')} ${approvalDate.toLocaleTimeString('en-GB')}`, 145, currentY + 18);
    doc.fillColor('#000000');
}
```

---

## 🔧 Setup Script

**File:** `backend/scripts/setupRegionalExpenseApprovers.js`

This script:
1. Creates the `regional_expense_approvers` table
2. Inserts mappings for Nashon and Mwansa
3. Verifies the configuration

**To run:**
```bash
cd backend
node scripts/setupRegionalExpenseApprovers.js
```

---

## 📊 Workflow Comparison

### EXPENSE CLAIMS (New Regional Workflow)

**Lusaka Department:**
```
Initiator → Mwansa Mwelwa (Regional Finance) → MD → Approved
```

**Solwezi/Operations Departments:**
```
Initiator → Nashon Nguni (Regional Finance) → MD → Approved
```

**Other Departments (IT, HR, Sales, etc.):**
```
Initiator → Anne Banda (Finance Manager) → MD → Approved
```

### EFT REQUISITIONS (Unchanged)
```
All Departments → Anne Banda (Finance Manager) → MD → Approved
```

### PURCHASE REQUISITIONS (Unchanged)
```
All Departments → HOD → Procurement → Finance → MD → Approved
```

---

## ✅ Testing Checklist

- [x] Regional approvers table created
- [x] Nashon mapped to Solwezi and Operations
- [x] Mwansa mapped to Lusaka
- [x] Department-based routing working
- [x] Regional approvers see only their department's claims
- [x] Regional approval endpoint working
- [x] MD can approve after regional approval
- [x] Status display updated in frontend
- [x] PDF shows regional approver signature
- [x] Other forms (EFT, PR) unaffected

---

## 🔐 Security & Permissions

### Regional Approver Authorization
1. **Role Verification**: User must be in `regional_expense_approvers` table
2. **Department Verification**: User can only approve claims from their assigned departments
3. **Status Verification**: Claim must be in `pending_regional` status

### Role Hierarchy
- Regional approvers maintain "initiator" role
- Authorization is determined by:
  - User role (for normal permissions)
  - `regional_expense_approvers` table (for regional approval permissions)

---

## 📍 Key Benefits

1. **Decentralized Approval**: Regional accountants handle their local claims
2. **Reduced Bottleneck**: Finance Manager only handles non-regional departments
3. **Dual Functionality**: Regional approvers can submit AND approve claims
4. **Flexible Assignment**: Easy to add/modify department assignments
5. **Isolated Impact**: Only affects expense claims, no risk to other forms
6. **Audit Trail**: Full electronic signatures with timestamps in PDFs

---

## 🚀 Future Enhancements (Optional)

1. Add UI for managing regional approver assignments
2. Support multiple approvers per department
3. Add email notifications for pending regional approvals
4. Create dashboard analytics for regional approval times
5. Extend to other form types if needed

---

## 📝 Important Notes

1. **Expense Claims Only**: This feature ONLY applies to expense claims. EFT Requisitions and Purchase Requisitions are NOT affected.

2. **Role Preservation**: Nashon and Mwansa keep their "initiator" role. The system checks the `regional_expense_approvers` table to determine approval permissions.

3. **Department Names**: Ensure exact match on department names:
   - "Solwezi" (not "solwezi")
   - "Operations" (not "operations")
   - "Lusaka" (not "lusaka")

4. **Backward Compatibility**: Departments without regional approvers continue using the Finance Manager workflow seamlessly.

---

**Implementation Date:** December 2, 2025
**Status:** 🟢 Fully Operational
**Testing:** ✅ All workflows verified
**Documentation:** ✅ Complete
