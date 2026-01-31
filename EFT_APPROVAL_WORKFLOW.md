# EFT Requisition Approval Workflow

**Date:** December 1, 2025
**Status:** ✅ IMPLEMENTED

## Overview

Complete approval workflow for EFT (Electronic Funds Transfer) requisitions with Finance Manager and Managing Director approval stages, including rejection with reasons and PDF download for approved forms.

---

## 🔄 Workflow Stages

### 1. **Initiator Submits EFT**
- **Who:** Any user with role `initiator`
- **Action:** Fills out EFT requisition form
- **Initial Status:** `pending_finance`
- **Form Location:** `eft-requisition.html`
- **Fields Include:**
  - Amount & Amount in Words
  - In Favour Of (Payee/Beneficiary) - Auto-populated
  - Bank Account Number *
  - Bank Name *
  - Branch *
  - Purpose
  - Account Code (optional)
  - Description (optional)

### 2. **Finance Manager Reviews**
- **Who:** Anne Banda (`anne.banda`) - Role: `finance`
- **Dashboard:** `forms-dashboard.html`
- **View:** ALL EFT requisitions
- **Status Filter:** `pending_finance`
- **Actions Available:**
  - ✅ **Approve** → Changes status to `finance_approved`
    - Optional: Add EFT/CHQ Number
  - ❌ **Reject** → Changes status to `rejected`
    - Optional: Provide rejection reason
- **API Endpoint:** `PUT /api/forms/eft-requisitions/:id/finance-action`

### 3. **Managing Director Final Approval**
- **Who:** Kanyembo Ndhlovu (`kanyembo.ndhlovu`) - Role: `md`
- **Dashboard:** `forms-dashboard.html`
- **View:** ONLY EFTs with status `finance_approved`
- **Actions Available:**
  - ✅ **Approve** → Changes status to `approved` (FINAL)
  - ❌ **Reject** → Changes status to `rejected`
    - Optional: Provide rejection reason
- **API Endpoint:** `PUT /api/forms/eft-requisitions/:id/md-action`

### 4. **Download Approved PDF**
- **Who:** Original initiator
- **Dashboard:** `forms-dashboard.html`
- **View:** Their own EFT requisitions with status `approved`
- **Action:** 📥 Download PDF button
- **API Endpoint:** `GET /api/forms/eft-requisitions/:id/pdf`

---

## 📊 Status Flow

```
pending_finance → (Finance Approve) → finance_approved → (MD Approve) → approved
       ↓                                      ↓
   (Finance Reject)                      (MD Reject)
       ↓                                      ↓
    rejected ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←← rejected
```

---

## 🎯 Implementation Details

### Backend Updates

**File:** `backend/routes/forms.js`

1. **Finance Action Endpoint** (Line 493-538)
   ```javascript
   router.put('/eft-requisitions/:id/finance-action',
              authenticate, authorize('finance', 'admin'), ...)
   ```
   - Validates status is `pending_finance`
   - On approve: Sets status to `finance_approved`
   - On reject: Sets status to `rejected`
   - Records action in `form_approvals` table
   - Optional: Updates EFT/CHQ number

2. **MD Action Endpoint** (Line 540-578)
   ```javascript
   router.put('/eft-requisitions/:id/md-action',
              authenticate, authorize('md', 'admin'), ...)
   ```
   - Validates status is `finance_approved`
   - On approve: Sets status to `approved`
   - On reject: Sets status to `rejected`
   - Records action in `form_approvals` table

3. **List Endpoint Filter** (Line 388-414)
   ```javascript
   router.get('/eft-requisitions', authenticate, ...)
   ```
   - **Initiators:** See only their own requisitions
   - **Finance:** See ALL requisitions
   - **MD:** See only `finance_approved`, `approved`, or `rejected`

---

### Frontend Updates

**File:** `frontend/forms-dashboard.html`

#### 1. Modal Action Buttons (Line 528-567)

**For Finance Manager:**
```html
<div class="w-full space-y-3">
    <div>
        <label>EFT/CHQ Number (Optional)</label>
        <input type="text" id="eftNumber" ...>
    </div>
    <div>
        <label>Rejection Reason (Optional - only used if rejecting)</label>
        <textarea id="rejectReason" rows="2" ...></textarea>
    </div>
    <div class="flex gap-3">
        <button onclick="approveEFTRequisition()" class="btn-success">✓ Approve</button>
        <button onclick="rejectEFTRequisition()" class="btn-danger">✗ Reject</button>
    </div>
</div>
```

**For Managing Director:**
```html
<div class="w-full space-y-3">
    <div>
        <label>Rejection Reason (Optional - only used if rejecting)</label>
        <textarea id="rejectReason" rows="2" ...></textarea>
    </div>
    <div class="flex gap-3">
        <button onclick="approveEFTRequisition()" class="btn-success">✓ Approve</button>
        <button onclick="rejectEFTRequisition()" class="btn-danger">✗ Reject</button>
    </div>
</div>
```

**For Initiator (Approved Forms):**
```html
<button onclick="downloadPDF('eft', '${id}')" class="btn-success">📥 Download PDF</button>
<button onclick="closeModal()" class="btn-primary">Close</button>
```

#### 2. Approve Function (Line 616-671)
- Confirms action with user
- Sends approve action to appropriate endpoint
- Includes EFT/CHQ number for Finance
- Reloads requisitions list on success

#### 3. Reject Function (Line 673-703)
- Confirms action with user
- Gets rejection reason from textarea field (optional)
- Sends reject action with comment
- Reloads requisitions list on success

#### 4. Download Function (Line 705+)
- Downloads PDF for approved forms
- Available to initiators for their approved requisitions

---

## 📝 Database Tables

### eft_requisitions
```sql
CREATE TABLE eft_requisitions (
    id TEXT PRIMARY KEY,
    eft_chq_number INTEGER,
    amount REAL NOT NULL,
    amount_in_words TEXT NOT NULL,
    in_favour_of TEXT NOT NULL,
    bank_account_number TEXT,
    bank_name TEXT,
    branch TEXT,
    purpose TEXT NOT NULL,
    account_code TEXT,
    description TEXT,
    initiator_id INTEGER NOT NULL,
    initiator_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_finance',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiator_id) REFERENCES users(id)
);
```

### form_approvals
```sql
CREATE TABLE form_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id TEXT NOT NULL,
    form_type TEXT NOT NULL,
    approver_role TEXT NOT NULL,
    approver_id INTEGER,
    approver_name TEXT,
    action TEXT,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approver_id) REFERENCES users(id)
);
```

---

## 🔐 Access Control

| Role      | Can View                      | Can Approve/Reject | Can Download PDF |
|-----------|-------------------------------|-------------------|------------------|
| Initiator | Own requisitions only         | ❌ No             | ✅ Yes (approved only) |
| Finance   | ALL requisitions              | ✅ Yes (pending_finance) | ✅ Yes (all) |
| MD        | finance_approved, approved, rejected | ✅ Yes (finance_approved) | ✅ Yes (all) |
| Admin     | ALL requisitions              | ✅ Yes (all statuses) | ✅ Yes (all) |

---

## ✅ Testing Checklist

- [x] Finance can view all pending EFT requisitions
- [x] Finance can approve with optional EFT/CHQ number
- [x] Finance can reject with optional reason
- [x] MD can view finance-approved requisitions only
- [x] MD can give final approval
- [x] MD can reject with optional reason
- [x] Initiator can view their own requisitions
- [x] Initiator can download PDF for approved requisitions
- [x] Rejection reason field is optional (not mandatory)
- [x] Status updates correctly through workflow
- [x] Form approvals are recorded in database

---

## 🎯 User Instructions

### For Initiators (Submitting EFT)
1. Login to system
2. Navigate to EFT Requisition form
3. Fill in all required fields (marked with *)
4. Submit form
5. Check Forms Dashboard to track approval status
6. When approved, download PDF from dashboard

### For Finance Manager (Anne Banda)
1. Login with: `anne.banda` / `Password123`
2. Go to Forms Dashboard
3. View "EFT Requisitions" section
4. Click on form with status "Pending Finance"
5. Review details
6. Optional: Enter EFT/CHQ Number
7. Optional: Enter rejection reason (if rejecting)
8. Click ✓ Approve or ✗ Reject

### For Managing Director (Kanyembo Ndhlovu)
1. Login with: `kanyembo.ndhlovu` / `Password123`
2. Go to Forms Dashboard
3. View "EFT Requisitions" section
4. See forms with status "Finance Approved"
5. Click on form to review
6. Optional: Enter rejection reason (if rejecting)
7. Click ✓ Approve (final approval) or ✗ Reject

---

## 📌 Key Features

✅ **Two-stage approval:** Finance → MD
✅ **Optional rejection reasons:** Not mandatory, user-friendly
✅ **EFT/CHQ number tracking:** Finance can assign numbers
✅ **Audit trail:** All approvals recorded in form_approvals table
✅ **Approval history display:** Full approval chain visible in modal with approver details, timestamps, and comments
✅ **Role-based visibility:** Each role sees only relevant forms
✅ **PDF download:** Approved forms available for download
✅ **Bank details:** Account number, bank name, branch captured
✅ **Auto-population:** Initiator name and date auto-filled

---

## 🔄 Next Steps (Optional)

1. Email notifications on approval/rejection
2. Comments history in modal
3. Print preview before download
4. Batch approval for multiple forms
5. Export to Excel for reporting
6. Form amendment/revision workflow

---

**Implementation Completed:** December 1, 2025
**Status:** 🟢 Fully Operational
**Testing:** ✅ All workflows verified
