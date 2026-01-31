# Forms System Implementation Guide

## Overview
This document describes the implementation of two new financial forms in the Purchase Requisition Approval System (PRAS):

1. **Expense Claim Form (FM-FI-014)**
2. **EFT/Cheque Requisition Form**

Both forms follow a standardized approval workflow: **Finance Manager → Managing Director**

---

## Database Schema

### New Tables Created

#### 1. expense_claims
Stores expense claim header information.

```sql
CREATE TABLE expense_claims (
  id TEXT PRIMARY KEY,                    -- Format: KSB-EC-YYYYMMDDHHmmss
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
  status TEXT NOT NULL,                   -- draft, pending_finance, pending_md, approved, rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiator_id) REFERENCES users(id)
)
```

#### 2. expense_claim_items
Stores individual expense line items (daily entries).

```sql
CREATE TABLE expense_claim_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id TEXT NOT NULL,
  report_no INTEGER NOT NULL,
  date TEXT NOT NULL,
  details TEXT NOT NULL,
  km REAL DEFAULT 0,
  breakfast INTEGER DEFAULT 0,            -- 0 or 1 (checkbox)
  lunch INTEGER DEFAULT 0,                -- 0 or 1 (checkbox)
  dinner INTEGER DEFAULT 0,               -- 0 or 1 (checkbox)
  meals REAL DEFAULT 0,
  accommodation REAL DEFAULT 0,
  sundries_phone REAL DEFAULT 0,
  total_zmw REAL DEFAULT 0,
  FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE
)
```

#### 3. eft_requisitions
Stores EFT/Cheque requisition information.

```sql
CREATE TABLE eft_requisitions (
  id TEXT PRIMARY KEY,                    -- Format: KSB-EFT-YYYYMMDDHHmmss
  eft_chq_number TEXT,                    -- Assigned by Finance
  amount REAL NOT NULL,
  amount_in_words TEXT NOT NULL,
  in_favour_of TEXT NOT NULL,
  purpose TEXT NOT NULL,
  account_code TEXT,
  description TEXT,
  initiator_id INTEGER NOT NULL,
  initiator_name TEXT NOT NULL,
  status TEXT NOT NULL,                   -- pending_finance, pending_md, approved, rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiator_id) REFERENCES users(id)
)
```

#### 4. form_approvals
Stores approval history for both form types.

```sql
CREATE TABLE form_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type TEXT NOT NULL,                -- 'expense_claim' or 'eft_requisition'
  form_id TEXT NOT NULL,
  role TEXT NOT NULL,                     -- 'finance' or 'md'
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,                   -- 'approve' or 'reject'
  comment TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## API Endpoints

All form endpoints are prefixed with `/api/forms/`

### Expense Claim Endpoints

#### GET /api/forms/expense-claims
Get all expense claims (filtered by user role)
- **Auth**: Required
- **Access**: All authenticated users
- **Filters**:
  - Initiators: See only their own claims
  - Finance: See all claims
  - MD: See only claims approved by Finance

#### GET /api/forms/expense-claims/:id
Get single expense claim with items and approvals
- **Auth**: Required
- **Returns**: Claim object with `items[]` and `approvals[]`

#### POST /api/forms/expense-claims
Create new expense claim
- **Auth**: Required (initiator, admin)
- **Body**:
```json
{
  "employee_name": "John Doe",
  "employee_number": "EMP123",
  "department": "Operations",
  "reason_for_trip": "Client visit to Lusaka",
  "km_rate": 5.50,
  "amount_advanced": 500.00,
  "items": [
    {
      "date": "2025-01-15",
      "details": "Travel + Meals",
      "km": 150,
      "breakfast": 1,
      "lunch": 1,
      "dinner": 0,
      "meals": 200.00,
      "accommodation": 500.00,
      "sundries_phone": 50.00,
      "total_zmw": 750.00
    }
  ]
}
```

#### PUT /api/forms/expense-claims/:id/submit
Submit draft claim for approval (calculates totals automatically)
- **Auth**: Required (initiator, admin)
- **Status Change**: draft → pending_finance

#### PUT /api/forms/expense-claims/:id/finance-action
Finance Manager approve/reject
- **Auth**: Required (finance, admin)
- **Body**:
```json
{
  "action": "approve",  // or "reject"
  "comment": "Optional comment"
}
```
- **Status Change**: pending_finance → pending_md (or rejected)

#### PUT /api/forms/expense-claims/:id/md-action
Managing Director approve/reject
- **Auth**: Required (md, admin)
- **Body**: Same as finance-action
- **Status Change**: pending_md → approved (or rejected)

#### GET /api/forms/expense-claims/:id/pdf
Download expense claim as PDF
- **Auth**: Required
- **Returns**: PDF file

### EFT Requisition Endpoints

#### GET /api/forms/eft-requisitions
Get all EFT requisitions (filtered by user role)

#### GET /api/forms/eft-requisitions/:id
Get single EFT requisition with approvals

#### POST /api/forms/eft-requisitions
Create new EFT requisition
- **Auth**: Required (initiator, admin)
- **Body**:
```json
{
  "amount": 3700.00,
  "amount_in_words": "Three Thousand Seven Hundred Kwacha",
  "in_favour_of": "Supplier ABC Ltd",
  "purpose": "Payment for office supplies",
  "account_code": "L12940641LO",
  "description": "Lusaka Trip"
}
```
- **Initial Status**: pending_finance

#### PUT /api/forms/eft-requisitions/:id/finance-action
Finance Manager approve/reject
- **Auth**: Required (finance, admin)
- **Body**:
```json
{
  "action": "approve",
  "comment": "Optional comment",
  "eft_chq_number": "71|08|25"  // Optional: EFT/Cheque number
}
```

#### PUT /api/forms/eft-requisitions/:id/md-action
Managing Director approve/reject
- **Auth**: Required (md, admin)

#### GET /api/forms/eft-requisitions/:id/pdf
Download EFT requisition as PDF
- **Auth**: Required
- **Returns**: PDF file

---

## Frontend Pages

### 1. expense-claim.html
Location: `frontend/expense-claim.html`

**Features**:
- Employee information form
- Dynamic expense items table
- Automatic calculations:
  - Total kilometers
  - Sub total (sum of all items)
  - Total travel (km × rate)
  - Total claim
  - Amount due (total claim - advance)
- Save as draft or submit for approval
- Real-time totals update

**Access**: Direct link or from dashboard

### 2. eft-requisition.html
Location: `frontend/eft-requisition.html`

**Features**:
- Payment amount entry
- Automatic amount-to-words conversion
- Beneficiary details
- Purpose and description
- Account code entry
- Submit directly for approval

**Access**: Direct link or from dashboard

---

## Approval Workflow

### Expense Claim Workflow
```
[Initiator Creates] → draft
       ↓
[Initiator Submits] → pending_finance
       ↓
[Finance Approves] → pending_md
       ↓
[MD Approves] → approved (PDF can be printed)
```

If rejected at any stage → status becomes `rejected`

### EFT Requisition Workflow
```
[Initiator Creates] → pending_finance
       ↓
[Finance Approves] → pending_md (assigns EFT/CHQ number)
       ↓
[MD Approves] → approved (PDF can be printed)
```

---

## PDF Generation

### Expense Claim PDF (FM-FI-014)
Generated using `backend/utils/formsPDFGenerator.js`

**Sections**:
1. Header with logo and form number
2. Employee details
3. Expense items table (up to 12 rows)
4. Totals section
5. Approval signatures (Finance Manager, MD)

### EFT Requisition PDF
Generated using `backend/utils/formsPDFGenerator.js`

**Sections**:
1. KSB header
2. Payment details (amount, beneficiary)
3. Purpose and description
4. Account code details
5. Approval signatures (Finance Manager, MD, Signatories)

---

## File Structure

```
backend/
├── database.js                      # Updated with new tables and CRUD operations
├── routes/
│   └── forms.js                     # All form routes (NEW)
├── utils/
│   └── formsPDFGenerator.js        # PDF generators for both forms (NEW)
└── server.js                        # Updated to include forms routes

frontend/
├── expense-claim.html               # Expense claim form (NEW)
├── eft-requisition.html            # EFT requisition form (NEW)
└── index.html                       # To be updated with form launch buttons
```

---

## Integration with Main Dashboard

To integrate these forms into the main dashboard (`index.html`), add buttons/cards in the appropriate sections:

### For Initiators
```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <a href="expense-claim.html" class="card-link">
    <div class="card">
      <h3>Expense Claim Form</h3>
      <p>Submit travel and expense claims</p>
    </div>
  </a>

  <a href="eft-requisition.html" class="card-link">
    <div class="card">
      <h3>EFT/Cheque Requisition</h3>
      <p>Request electronic payment or cheque</p>
    </div>
  </a>
</div>
```

### For Finance & MD
Add sections to view pending forms:
- List of pending expense claims
- List of pending EFT requisitions
- Action buttons (Approve/Reject)
- PDF download links

---

## Status Values

### Expense Claims
- `draft` - Created but not submitted
- `pending_finance` - Awaiting Finance Manager approval
- `pending_md` - Awaiting MD approval
- `approved` - Fully approved
- `rejected` - Rejected at any stage

### EFT Requisitions
- `pending_finance` - Awaiting Finance Manager approval
- `pending_md` - Awaiting MD approval
- `approved` - Fully approved
- `rejected` - Rejected at any stage

---

## Testing Checklist

- [ ] Create expense claim as initiator
- [ ] Save expense claim as draft
- [ ] Submit expense claim for approval
- [ ] Approve expense claim as Finance Manager
- [ ] Approve expense claim as MD
- [ ] Download expense claim PDF
- [ ] Reject expense claim at Finance level
- [ ] Create EFT requisition
- [ ] Approve EFT requisition as Finance (with EFT number)
- [ ] Approve EFT requisition as MD
- [ ] Download EFT requisition PDF
- [ ] Verify role-based access controls
- [ ] Test PDF generation for both forms

---

## Next Steps

1. **Update index.html** - Add cards/buttons to launch both forms
2. **Add forms lists** - Display pending forms for Finance/MD roles
3. **Test workflow** - Complete end-to-end testing
4. **Deploy** - Restart server to load new routes and database schema

---

## Usage Example

### Creating an Expense Claim

1. User navigates to `expense-claim.html`
2. Fills in employee details and reason for trip
3. Adds expense items (dates, details, amounts)
4. System auto-calculates totals
5. User can "Save as Draft" or "Submit for Approval"
6. Finance Manager sees claim in pending list
7. Finance Manager approves → claim moves to MD
8. MD approves → claim status = approved
9. PDF can be downloaded and printed for filing

### Creating an EFT Requisition

1. User navigates to `eft-requisition.html`
2. Enters payment amount (system auto-generates words)
3. Enters beneficiary and purpose
4. Submits requisition
5. Finance Manager approves and assigns EFT number
6. MD approves
7. PDF can be downloaded for processing

---

## Database Migration

When deploying, the new tables will be created automatically when the server starts. The `createTables()` function in `database.js` uses `CREATE TABLE IF NOT EXISTS`, so existing data is safe.

---

## Support & Maintenance

For issues or enhancements:
1. Check server logs for errors
2. Verify database schema
3. Test API endpoints using tools like Postman
4. Review PDF generation logic in `formsPDFGenerator.js`

---

**Implementation Date**: 2025-12-01
**Version**: 1.0
**Status**: Complete
