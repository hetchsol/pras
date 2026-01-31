# Tax System Update - Moved to Procurement

**Date:** November 18, 2025
**Status:** ✅ COMPLETED

---

## Change Summary

The tax type selection (VAT vs TOT) has been **moved from initiators to procurement**. This change reflects the proper workflow where procurement personnel determine the appropriate tax type based on vendor registration status.

---

## Key Changes

### 1. **Initiator Experience**
- ✅ **Removed** tax type dropdown from initiator requisition form
- ✅ Initiators only fill in: items, quantities, justification, urgency, required date
- ✅ No tax calculations shown to initiators (they don't see VAT/TOT options)
- ✅ Form displays "Tax: Will be determined by Procurement" when prices are visible

### 2. **Procurement Experience**
- ✅ **Added** tax type dropdown to procurement requisition form
- ✅ Procurement sees two options:
  - **VAT (16% Tax)** - For VAT-registered vendors
  - **TOT (No Tax)** - For TOT-registered vendors
- ✅ Tax calculations displayed in real-time based on selection
- ✅ Grand total includes or excludes tax based on selection

---

## Workflow

### Step 1: Initiator Creates Requisition
```
Initiator fills out:
├─ Line items (description, quantity)
├─ Required date
├─ Urgency level
└─ Justification

⚠️ NO tax selection required
```

### Step 2: HOD Approves
```
HOD reviews and approves/rejects
└─ Proceeds to Procurement if approved
```

### Step 3: Procurement Adds Pricing & Tax Type
```
Procurement adds:
├─ Unit prices for each item
├─ Vendor information
└─ Tax Type (VAT or TOT) ⭐ NEW

System calculates:
├─ Subtotal (sum of all items)
├─ Tax (16% if VAT, 0% if TOT)
└─ Grand Total
```

### Step 4: Finance & MD Approval
```
Finance and MD see final amounts with correct tax
```

### Step 5: PDF Generation
```
PDF shows:
├─ Subtotal
├─ VAT (16%): ZMW XXX  OR  Tax (TOT): No Tax
└─ Grand Total
```

---

## Technical Implementation

### Frontend Changes (`frontend/app.js`)

#### 1. Form State Update
```javascript
// Before: taxType always initialized to 'VAT'
taxType: 'VAT'

// After: Only for procurement
taxType: user.role === 'procurement' ? 'VAT' : null
```

#### 2. Conditional Tax Dropdown
```javascript
// Tax dropdown only shown if user.role === 'procurement'
user.role === 'procurement'
  ? // Show two-column layout with Tax Type dropdown
  : // Show single-column layout without Tax Type
```

#### 3. Conditional Tax Display
```javascript
// Initiators see:
"Tax: Will be determined by Procurement"

// Procurement sees:
formData.taxType === 'VAT' → "VAT (16%): ZMW XXX"
formData.taxType === 'TOT' → "Tax (TOT): No Tax Applied"
```

#### 4. Totals Label
```javascript
// Initiators see: "Subtotal: ZMW XXX"
// Procurement sees: "Grand Total: ZMW XXX"
```

### Backend Changes

#### 1. Requisition Creation (`backend/server.js:2020`)
```javascript
// Before: Default to 'VAT'
tax_type = 'VAT'

// After: Default to null (will be set by procurement)
tax_type = null
```

#### 2. Procurement Update Endpoint (`backend/server.js:1981`)
```javascript
// Added tax_type to procurement update fields
if (updateData.tax_type !== undefined) {
    fields.push('tax_type = ?');
    values.push(updateData.tax_type);
}
```

#### 3. PDF Generator (`backend/utils/pdfGenerator.js:273`)
```javascript
// Default to VAT if not set (backwards compatibility)
const taxType = requisition.tax_type || 'VAT';

if (taxType === 'VAT') {
    tax = subtotal * 0.16;
    // Display: VAT (16%): ZMW XXX
} else if (taxType === 'TOT') {
    tax = 0;
    // Display: Tax (TOT): No Tax
}
```

---

## Tax Calculation Examples

### Example 1: VAT Requisition (Procurement Creates)
```
Line Items:
  - Office Chairs (10 × ZMW 500) = ZMW 5,000
  - Desks (5 × ZMW 1,200) = ZMW 6,000

Subtotal:     ZMW 11,000.00
VAT (16%):    ZMW  1,760.00
Grand Total:  ZMW 12,760.00  ✓
```

### Example 2: TOT Requisition (Procurement Creates)
```
Line Items:
  - Office Chairs (10 × ZMW 500) = ZMW 5,000
  - Desks (5 × ZMW 1,200) = ZMW 6,000

Subtotal:     ZMW 11,000.00
Tax (TOT):    No Tax
Grand Total:  ZMW 11,000.00  ✓
```

### Example 3: Initiator Creates (No Tax Selection)
```
Line Items:
  - Office Chairs (10 units)
  - Desks (5 units)

Tax: Will be determined by Procurement

Note: Initiators don't see pricing or tax calculations
```

---

## Benefits of This Approach

### ✅ **Better Workflow Alignment**
- Tax determination happens where pricing is added
- Procurement has vendor information to make correct tax decision
- Reduces confusion for initiators

### ✅ **Reduced Errors**
- Initiators can't select wrong tax type
- Procurement makes informed decision based on vendor registration
- Single point of responsibility

### ✅ **Cleaner User Experience**
- Initiators see simpler form
- Only procurement sees tax-related options
- Each role sees only relevant information

### ✅ **Backwards Compatible**
- Existing requisitions default to VAT if no tax_type set
- No data migration required
- PDF generation handles null/missing tax_type gracefully

---

## Database Schema

### Requisitions Table
```sql
-- tax_type column stores the tax selection
tax_type TEXT DEFAULT NULL

-- Possible values:
-- NULL  = Not yet determined (initiator created, procurement hasn't set)
-- 'VAT' = VAT-registered vendor (16% tax)
-- 'TOT' = TOT-registered vendor (no tax)
```

---

## User Guide

### For Initiators

**Creating a Requisition:**
1. Fill in line items (description and quantity)
2. Select required date
3. Choose urgency level
4. Provide justification
5. Submit

**What You Don't Need:**
- ❌ Don't select tax type (handled by procurement)
- ❌ Don't worry about unit prices (filled by procurement)
- ❌ Don't calculate totals (system does this)

### For Procurement

**When Creating Requisitions on Behalf of Departments:**
1. Fill in all line items with quantities AND prices
2. Select required date and urgency
3. **Select Tax Type:**
   - Choose **VAT (16% Tax)** if vendor is VAT-registered
   - Choose **TOT (No Tax)** if vendor is TOT-registered
4. Select HOD approver
5. Provide justification
6. Submit

**Tax Type Decision Guide:**
- Check vendor's tax registration status
- VAT-registered vendors → Select **VAT**
- TOT-registered vendors → Select **TOT**
- If unsure, consult with Finance

### For Other Roles (HOD, Finance, MD)

**Reviewing Requisitions:**
- View shows correct tax calculation
- VAT requisitions show 16% tax added
- TOT requisitions show no tax
- Grand total is always correct based on tax type

---

## Testing Checklist

### Initiator Form
- ✅ Tax dropdown not visible to initiators
- ✅ Initiators can create requisitions without tax selection
- ✅ Form shows "Will be determined by Procurement" for tax
- ✅ No tax calculations shown to initiators

### Procurement Form
- ✅ Tax dropdown visible to procurement
- ✅ VAT option adds 16% tax to calculations
- ✅ TOT option shows no tax
- ✅ Grand total updates dynamically with tax selection
- ✅ Procurement can create requisitions with tax type

### Backend
- ✅ Initiator requisitions save with tax_type = null
- ✅ Procurement requisitions save with selected tax_type
- ✅ Procurement can update tax_type via update endpoint
- ✅ Database accepts null, 'VAT', and 'TOT' values

### PDF Generation
- ✅ VAT requisitions show "VAT (16%): ZMW XXX"
- ✅ TOT requisitions show "Tax (TOT): No Tax"
- ✅ Old requisitions (null tax_type) default to VAT
- ✅ Grand total calculated correctly for both types

---

## Migration Notes

### Existing Requisitions
- All existing requisitions have `tax_type = NULL` or `tax_type = 'VAT'`
- PDF generator handles both cases correctly
- No manual data update required
- System defaults to VAT for backwards compatibility

### Future Requisitions
- **Initiator-created:** `tax_type = NULL` until procurement sets it
- **Procurement-created:** `tax_type = 'VAT' or 'TOT'` from creation

---

## Files Modified

### Frontend
1. **`frontend/app.js`** (Lines: 2196, 2256, 2584-2622, 2537-2569)
   - Conditional tax dropdown rendering
   - Role-based tax calculations display
   - Conditional form layout

### Backend
1. **`backend/server.js`** (Lines: 2020, 1981)
   - Default tax_type to null for initiators
   - Added tax_type to procurement update endpoint

2. **`backend/utils/pdfGenerator.js`** (Lines: 272-285)
   - Handle null tax_type with VAT default
   - Conditional tax display in PDF

---

## Support

### Common Questions

**Q: What happens if initiator submits without tax type?**
A: That's normal! Tax type is set by procurement when they add pricing.

**Q: Can procurement change tax type after creating requisition?**
A: Yes, through the procurement update endpoint.

**Q: What if old requisitions don't have tax_type?**
A: System defaults to VAT for backwards compatibility.

**Q: How does procurement know which tax type to use?**
A: Check vendor's tax registration status with Finance if unsure.

---

## System Status

### Current Configuration
- **Backend:** Running on http://localhost:3001 ✅
- **Database:** tax_type column exists ✅
- **Initiator Form:** Tax dropdown removed ✅
- **Procurement Form:** Tax dropdown active ✅
- **PDF Generator:** Updated for conditional tax ✅

---

## Conclusion

The tax system has been successfully moved to procurement, improving workflow alignment and reducing errors. Initiators now have a simpler form, while procurement has full control over tax determination at the appropriate stage of the process.

**Key Takeaway:** Tax type selection happens when pricing is added, not when requisition is created.
