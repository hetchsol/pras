# Purchase Requisition System - Complete Workflow Guide

## Version 2.2.0
**Date:** October 23, 2025

---

## Table of Contents
1. [Overview](#overview)
2. [User Roles](#user-roles)
3. [Workflow Stages](#workflow-stages)
4. [API Endpoints](#api-endpoints)
5. [Workflow Examples](#workflow-examples)
6. [Status Transitions](#status-transitions)

---

## Overview

The Purchase Requisition System follows a multi-stage approval workflow:

```
Draft → Submitted → HOD Review → Approved → Procurement → Completed
                        ↓
                    Rejected
                        ↓
                    (with reason)
```

### Key Features:
- **Draft & Submit**: Requisitioners can save drafts and submit when ready
- **HOD Approval/Rejection**: HOD must provide comments for their decision
- **Admin Redirection**: Admin can redirect requisitions to different approvers
- **Procurement Processing**: Add vendor selection and pricing
- **Multiple Items**: Add multiple items with "+Add Item" functionality
- **PDF Generation**: Generate professional PDF documents for approved requisitions
- **Automatic Calculations**: System calculates total prices automatically

---

## User Roles

| Role | Permissions | Description |
|------|-------------|-------------|
| **Initiator** | Create, Edit Draft, Submit | Employees who create requisitions |
| **HOD** | Approve, Reject, Comment | Head of Department - Reviews requisitions |
| **Procurement** | Add Vendors, Pricing, Items | Handles vendor selection and pricing |
| **Admin** | All + Redirect | Full system access + redirect requisitions |
| **Finance** | View, Approve (future) | Financial approval (if needed) |
| **MD** | View, Final Approve (future) | Managing Director approval (if needed) |

---

## Workflow Stages

### 1. **Draft Stage** (Status: `draft`)

**Who:** Initiator/Requisitioner

**Actions:**
- Create requisition with basic details
- Add items (multiple items supported)
- Save as draft (can edit later)
- Submit for HOD review

**API Endpoints:**
```http
POST /api/requisitions
PUT /api/requisitions/:id/items/:item_id
POST /api/requisitions/:id/submit
```

**Example Request (Create):**
```json
POST /api/requisitions
{
  "description": "Office supplies for IT Department",
  "delivery_location": "IT Office, 3rd Floor",
  "urgency": "High",
  "required_date": "2025-11-01",
  "account_code": "IT-2025-001",
  "created_by": 1,
  "items": [
    {
      "item_name": "Laptops - Dell Latitude 5520",
      "quantity": 5,
      "specifications": "i7, 16GB RAM, 512GB SSD"
    },
    {
      "item_name": "Wireless Mouse",
      "quantity": 5,
      "specifications": "Logitech M330"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "requisition_id": 1,
  "req_number": "KSB-IT-JB-20251023134500"
}
```

---

### 2. **Submitted Stage** (Status: `pending_hod`)

**Who:** Initiator

**Actions:**
- Submit draft requisition for HOD review
- No more edits allowed after submission

**API Endpoint:**
```http
PUT /api/requisitions/:id/submit
```

**Example Request:**
```json
PUT /api/requisitions/1/submit
{
  "user_id": 1
}
```

---

### 3. **HOD Review Stage** (Status: `pending_hod`)

**Who:** HOD (Head of Department)

**Actions:**
- Review requisition details
- **Approve** (moves to `hod_approved`) OR
- **Reject** (moves to `rejected` with mandatory reason)

**API Endpoint:**
```http
PUT /api/requisitions/:id/hod-approve
```

**Example Request (Approval):**
```json
PUT /api/requisitions/1/hod-approve
{
  "user_id": 2,
  "approved": true,
  "comments": "Approved. Required for new project team."
}
```

**Example Request (Rejection):**
```json
PUT /api/requisitions/1/hod-approve
{
  "user_id": 2,
  "approved": false,
  "comments": "Budget not available for this quarter. Please resubmit in Q2."
}
```

**Response (Approval):**
```json
{
  "success": true,
  "message": "Requisition approved successfully",
  "status": "hod_approved"
}
```

**Response (Rejection):**
```json
{
  "success": true,
  "message": "Requisition rejected",
  "status": "rejected"
}
```

**Note:** Comments are **mandatory** for rejection!

---

### 4. **Admin Redirection** (Any Stage)

**Who:** Admin Only

**When:** HOD is absent or needs to reassign

**Actions:**
- Redirect requisition to another approver
- Must provide reason for redirection
- Specify stage (hod_approval, procurement, etc.)

**API Endpoint:**
```http
POST /api/requisitions/:id/redirect
```

**Example Request:**
```json
POST /api/requisitions/1/redirect
{
  "from_user_id": 2,
  "to_user_id": 4,
  "reason": "Original HOD on leave. Redirecting to Acting HOD.",
  "stage": "hod_approval"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Requisition redirected to Sarah Banda",
  "redirection_id": 1
}
```

---

### 5. **Procurement Stage** (Status: `hod_approved`)

**Who:** Procurement Officer

**Actions:**
- Add/update items with vendor information
- Set unit prices (auto-calculates total)
- Select preferred vendors from dropdown
- Add multiple items with "+Add Item"
- Complete procurement process

**API Endpoints:**
```http
POST /api/requisitions/:id/items
PUT /api/requisitions/:id/items/:item_id
PUT /api/requisitions/:id/procurement
```

**Example: Add New Item**
```json
POST /api/requisitions/1/items
{
  "item_name": "USB-C Cables",
  "quantity": 10,
  "unit_price": 25.00,
  "vendor_id": 1,
  "specifications": "1.5m length, fast charging"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item added successfully",
  "item_id": 3
}
```

**Example: Update Item with Pricing**
```json
PUT /api/requisitions/1/items/1
{
  "unit_price": 5500.00,
  "vendor_id": 1
}
```

**Automatic Calculation:**
- Unit Price: K5,500.00
- Quantity: 5
- **Total Price: K27,500.00** (calculated automatically)
- **Grand Total: Sum of all item totals** (updated automatically)

**Example: Complete Procurement**
```json
PUT /api/requisitions/1/procurement
{
  "user_id": 3,
  "comments": "All vendors confirmed. Delivery in 2 weeks."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Procurement completed successfully"
}
```

---

### 6. **PDF Generation** (Status: `hod_approved` or `procurement_completed`)

**Who:** Any authenticated user

**Actions:**
- Generate professional PDF document
- Download or share requisition
- PDF includes all details, items, pricing, approvals

**API Endpoint:**
```http
GET /api/requisitions/:id/pdf
```

**Example Request:**
```bash
curl -X GET http://localhost:3001/api/requisitions/1/pdf \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output requisition.pdf
```

**PDF Contents:**
- Company header
- Requisition number and details
- Requestor information
- Items table with pricing
- Grand total
- Approval information
- Procurement details (if completed)
- Generated timestamp

**Response:**
- Content-Type: `application/pdf`
- File download: `Requisition_KSB-IT-JB-20251023134500.pdf`

---

## API Endpoints Summary

### Requisition Management
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/requisitions` | ✅ | All | List all requisitions |
| GET | `/api/requisitions/:id` | ✅ | All | Get single requisition |
| POST | `/api/requisitions` | ✅ | Initiator, Admin | Create new requisition |
| PUT | `/api/requisitions/:id/submit` | ✅ | Initiator, Admin | Submit for approval |
| PUT | `/api/requisitions/:id/hod-approve` | ✅ | HOD, Admin | Approve/Reject |

### Item Management
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/api/requisitions/:id/items` | ✅ | Initiator, Admin, Procurement | Add item |
| PUT | `/api/requisitions/:id/items/:item_id` | ✅ | Initiator, Admin, Procurement | Update item |

### Procurement
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| PUT | `/api/requisitions/:id/procurement` | ✅ | Procurement, Admin | Complete procurement |
| GET | `/api/vendors` | ✅ | All | List vendors |

### Admin Functions
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/api/requisitions/:id/redirect` | ✅ | Admin | Redirect requisition |

### PDF Generation
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/requisitions/:id/pdf` | ✅ | All | Generate PDF |

---

## Workflow Examples

### Example 1: Complete Happy Path

```javascript
// 1. Initiator creates requisition
POST /api/requisitions
{
  "description": "New laptops for developers",
  "created_by": 1,
  "items": [...]
}
// Response: requisition_id = 1

// 2. Initiator submits
PUT /api/requisitions/1/submit
{ "user_id": 1 }
// Status: draft → pending_hod

// 3. HOD approves
PUT /api/requisitions/1/hod-approve
{
  "user_id": 2,
  "approved": true,
  "comments": "Approved for Q4 budget"
}
// Status: pending_hod → hod_approved

// 4. Procurement adds vendor and pricing
PUT /api/requisitions/1/items/1
{
  "unit_price": 5500.00,
  "vendor_id": 1
}

PUT /api/requisitions/1/procurement
{
  "user_id": 3,
  "comments": "All items priced and vendors selected"
}
// Status: hod_approved → procurement_completed

// 5. Generate PDF
GET /api/requisitions/1/pdf
// Downloads PDF document
```

---

### Example 2: Rejection Scenario

```javascript
// 1. HOD rejects with reason
PUT /api/requisitions/1/hod-approve
{
  "user_id": 2,
  "approved": false,
  "comments": "Specification too expensive. Please find alternatives."
}
// Status: pending_hod → rejected

// Requisition cannot proceed further
// Initiator must create new requisition with updated specs
```

---

### Example 3: Admin Redirection

```javascript
// 1. Admin redirects to acting HOD
POST /api/requisitions/1/redirect
{
  "from_user_id": 2,
  "to_user_id": 4,
  "reason": "Original HOD unavailable",
  "stage": "hod_approval"
}

// 2. Acting HOD now approves
PUT /api/requisitions/1/hod-approve
{
  "user_id": 4,
  "approved": true,
  "comments": "Approved"
}
```

---

### Example 4: Adding Multiple Items

```javascript
// Add first item
POST /api/requisitions/1/items
{
  "item_name": "Laptop",
  "quantity": 3,
  "specifications": "Dell i7"
}

// Add second item (using "+Add Item" button)
POST /api/requisitions/1/items
{
  "item_name": "Mouse",
  "quantity": 3
}

// Add third item
POST /api/requisitions/1/items
{
  "item_name": "Keyboard",
  "quantity": 3
}

// Later: Procurement adds pricing
PUT /api/requisitions/1/items/1
{
  "unit_price": 5500.00,
  "vendor_id": 1
}

PUT /api/requisitions/1/items/2
{
  "unit_price": 150.00,
  "vendor_id": 2
}

PUT /api/requisitions/1/items/3
{
  "unit_price": 250.00,
  "vendor_id": 2
}

// Grand Total automatically calculated:
// (3 × 5500) + (3 × 150) + (3 × 250) = 16,500 + 450 + 750 = K17,700.00
```

---

## Status Transitions

### Valid Status Flow

```
draft
  ↓ (submit)
pending_hod
  ↓ (HOD approve)    ↓ (HOD reject)
hod_approved        rejected
  ↓ (procurement complete)
procurement_completed
```

### Status Descriptions

| Status | Description | Next Possible Status |
|--------|-------------|---------------------|
| `draft` | Initial creation | `pending_hod` |
| `pending_hod` | Awaiting HOD review | `hod_approved`, `rejected` |
| `hod_approved` | HOD approved | `procurement_completed` |
| `rejected` | HOD rejected | *Terminal state* |
| `procurement_completed` | All done | *Terminal state* |

---

## Database Schema (Enhanced)

### Requisitions Table (New Columns)

```sql
-- Rejection tracking
rejection_reason TEXT
rejected_by INTEGER
rejected_at DATETIME

-- Procurement tracking
procurement_status TEXT DEFAULT 'pending'
procurement_assigned_to INTEGER
procurement_completed_at DATETIME
procurement_comments TEXT

-- Redirection tracking
current_approver_id INTEGER
is_redirected BOOLEAN DEFAULT 0
```

### New Table: Requisition Redirections

```sql
CREATE TABLE requisition_redirections (
    id INTEGER PRIMARY KEY,
    requisition_id INTEGER NOT NULL,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    redirected_by INTEGER NOT NULL,
    reason TEXT NOT NULL,
    stage TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## Error Handling

### Common Errors

| Error | Status Code | Reason | Solution |
|-------|-------------|--------|----------|
| Comments required when rejecting | 400 | No comments provided | Add comments field |
| PDF can only be generated for approved requisitions | 400 | Wrong status | Wait for HOD approval |
| Item name and quantity are required | 400 | Missing fields | Provide all required fields |
| Requisition not found | 404 | Invalid ID | Check requisition ID |
| Access denied | 401/403 | Wrong role | Use correct user role |

---

## Best Practices

### For Initiators:
1. Always save as draft first
2. Review all details before submitting
3. Add clear item descriptions and specifications
4. Set realistic required dates

### For HOD:
1. Always provide meaningful comments
2. Comments are mandatory for rejections
3. Be specific about rejection reasons
4. Review all items before approving

### For Procurement:
1. Get quotes from multiple vendors
2. Always select vendor from dropdown
3. Double-check unit prices before saving
4. Verify grand total is correct
5. Add procurement comments when completing

### For Admin:
1. Only redirect when necessary
2. Always provide clear reason for redirection
3. Verify target user has appropriate role
4. Document redirection in comments

---

## Testing Checklist

- [ ] Create draft requisition
- [ ] Add multiple items
- [ ] Submit for approval
- [ ] HOD approve with comments
- [ ] HOD reject with comments (test mandatory validation)
- [ ] Admin redirect requisition
- [ ] Procurement add vendor and pricing
- [ ] Verify grand total calculation
- [ ] Complete procurement
- [ ] Generate PDF (should work)
- [ ] Try PDF on draft (should fail with error)

---

## Security Features

1. **Authentication Required**: All endpoints require JWT token
2. **Role-Based Access**: Each endpoint checks user role
3. **Audit Logging**: All actions logged to audit_log table
4. **Security Logging**: Critical actions logged to security.log
5. **Input Validation**: All inputs validated
6. **SQL Injection Prevention**: Parameterized queries only

---

## Next Steps / Future Enhancements

- [ ] Email notifications on status changes
- [ ] Budget checking before approval
- [ ] Multiple approval levels (Finance, MD)
- [ ] Requisition cancellation workflow
- [ ] Bulk item upload (CSV/Excel)
- [ ] Requisition templates
- [ ] Vendor rating system
- [ ] Purchase order generation

---

**Version:** 2.2.0
**Last Updated:** October 23, 2025
**Status:** ✅ Complete and Ready for Use

For technical implementation details, see: `NEW_FEATURES_V2.1.md`
For security information, see: `SECURITY.md`
