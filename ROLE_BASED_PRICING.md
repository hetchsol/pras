# Role-Based Pricing: Initiator vs Procurement

## Overview
Unit price entry is now **role-based**:
- **Initiators** - Cannot enter unit prices (field is greyed out)
- **Procurement** - Can enter unit prices (field is editable)

This reflects the real-world workflow where initiators request items without knowing prices, and procurement fills in pricing details during the approval process.

## Implementation

### Changes Made (`frontend/app.js`)

#### 1. Unit Price Field - Role-Based (Lines 2498-2513)

**For Initiators:**
```javascript
- Field is disabled (greyed out)
- Background: grey (#bg-gray-100)
- Text color: grey (#text-gray-500)
- Cursor: not-allowed
- Placeholder: "To be filled by Procurement"
- Label: "Unit Price (ZMW)" (no asterisk)
- Tooltip: "Unit price will be filled by Procurement"
```

**For Procurement:**
```javascript
- Field is enabled (editable)
- Background: white
- Text color: black
- Normal cursor
- Placeholder: "0.00"
- Label: "Unit Price (ZMW) *" (required asterisk)
- Tooltip: "Enter unit price"
```

#### 2. Validation - Role-Based (Lines 2351-2358)

**For Initiators:**
- ✅ No unit price validation
- Can submit without any prices
- Prices will be filled by procurement later

**For Procurement:**
- ✅ Must provide unit price for at least one item
- Cannot submit without pricing
- Alert: "Please provide unit price for at least one item"

#### 3. Totals Panel - Smart Display (Lines 2526-2553)

**For Initiators (no prices entered):**
- Shows panel with message: _"Unit prices will be filled by Procurement"_
- Blue informational styling
- No zero values displayed

**For Initiators (if prices somehow entered):**
- Shows calculated totals normally

**For Procurement:**
- Always shows totals with calculations
- Subtotal, VAT (16%), Grand Total

## Visual Comparison

### Initiator View
```
┌──────────────────────────────────────────────────────┐
│  Item 1                              [Remove 🗑️]     │
│  ┌─────────────┬────────┬─────────────────────────┐  │
│  │ Description │  Qty   │  Unit Price (ZMW)       │  │
│  │ Laptops     │   5    │  [GREYED OUT - DISABLED]│  │
│  │             │        │  To be filled by...     │  │
│  └─────────────┴────────┴─────────────────────────┘  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  💰 Requisition Totals                               │
│  Unit prices will be filled by Procurement           │
└──────────────────────────────────────────────────────┘
```

### Procurement View
```
┌──────────────────────────────────────────────────────┐
│  Item 1                              [Remove 🗑️]     │
│  ┌─────────────┬────────┬─────────────────────────┐  │
│  │ Description │  Qty   │  Unit Price (ZMW)*      │  │
│  │ Laptops     │   5    │  15000.00 [EDITABLE]    │  │
│  └─────────────┴────────┴─────────────────────────┘  │
│  Item Total: ZMW 75,000.00                           │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  💰 Requisition Totals                               │
│  Subtotal:                   ZMW 75,000.00           │
│  VAT (16%):                  ZMW 12,000.00           │
│  ──────────────────────────────────────────────────  │
│  Grand Total:                ZMW 87,000.00           │
└──────────────────────────────────────────────────────┘
```

## Workflow

### Initiator Workflow
1. **Create Requisition**
   - Add line items (description + quantity only)
   - Write single justification
   - Select date and urgency
2. **Submit**
   - No pricing required
   - Requisition goes to HOD for approval
3. **Items saved with:**
   - unit_price: 0 or empty
   - total_price: 0
   - All other fields filled

### Procurement Workflow
1. **Create Requisition** (if procurement creates directly)
   - Add line items with full pricing
   - Must enter unit prices
   - Select HOD approver
2. **Submit**
   - Pricing validation enforced
   - All prices must be filled
3. **Items saved with:**
   - unit_price: actual price
   - total_price: calculated (qty × price)
   - All fields complete

### Procurement Updates Initiator's Requisition
During approval/review process, procurement can:
1. View requisition created by initiator
2. Add unit prices to items
3. System recalculates totals
4. Continue approval flow

## Technical Details

### CSS Classes by Role

**Initiator (Disabled):**
```javascript
className: "w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200"
```

**Procurement (Enabled):**
```javascript
className: "w-full px-3 py-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500"
```

### Conditional Rendering Logic

```javascript
// Label
user.role === 'initiator' ? "Unit Price (ZMW)" : "Unit Price (ZMW) *"

// Disabled
disabled: user.role === 'initiator'

// Placeholder
user.role === 'initiator' ? 'To be filled by Procurement' : '0.00'

// Validation
if (user.role === 'procurement') {
  // Check prices
}
```

## Database Impact

### Initiator Submissions
Items stored with:
```javascript
{
  item_name: 'Laptops',
  quantity: 5,
  unit_price: 0,  // or empty
  total_price: 0,
  specifications: 'Justification...',
  currency: 'ZMW'
}
```

### Procurement Submissions
Items stored with:
```javascript
{
  item_name: 'Laptops',
  quantity: 5,
  unit_price: 15000.00,
  total_price: 75000.00,
  specifications: 'Justification...',
  currency: 'ZMW'
}
```

## Benefits

### 1. **Realistic Workflow**
- Initiators don't need to know prices
- Procurement handles pricing (their expertise)
- Clear separation of responsibilities

### 2. **Better User Experience**
- No confusion about what to fill
- Clear visual indication (greyed out)
- Helpful placeholder text

### 3. **Prevents Errors**
- Initiators can't enter incorrect prices
- Procurement ensures accurate pricing
- Reduces price estimation guesswork

### 4. **Flexibility**
- Initiators can still create requisitions quickly
- Procurement adds pricing during review
- Maintains workflow efficiency

### 5. **Clear Communication**
- "To be filled by Procurement" message
- Tooltip explains why field is disabled
- No asterisk (not required) for initiators

## Validation Summary

| Role | Unit Price Required? | Validation Message |
|------|---------------------|-------------------|
| Initiator | ❌ No | N/A |
| Procurement | ✅ Yes | "Please provide unit price for at least one item" |

## Files Modified
- `frontend/app.js` (Lines 2498-2513, 2351-2358, 2526-2553)

## Testing Instructions

### Test 1: Initiator Cannot Edit Price
1. Login as initiator
2. Create new requisition
3. Add item
4. Try to click unit price field
5. ✅ Field should be greyed out and unclickable
6. ✅ Placeholder shows "To be filled by Procurement"

### Test 2: Initiator Can Submit Without Price
1. Login as initiator
2. Create requisition with items
3. Fill description, quantity, justification
4. Leave unit prices empty (greyed out)
5. Click "Submit for Approval"
6. ✅ Should submit successfully without price validation error

### Test 3: Procurement Must Enter Prices
1. Login as procurement
2. Create new requisition
3. Add items with description and quantity
4. Leave unit prices empty
5. Try to submit
6. ✅ Should show error: "Please provide unit price for at least one item"
7. Fill at least one unit price
8. ✅ Should submit successfully

### Test 4: Totals Panel Behavior
1. Login as initiator
2. Create requisition
3. ✅ Totals panel shows: "Unit prices will be filled by Procurement"
4. Logout, login as procurement
5. Create requisition with prices
6. ✅ Totals panel shows calculated subtotal, VAT, grand total

## Notes
- Unit price field is always visible (for context)
- Only editability changes based on role
- Initiators see placeholder explaining procurement will fill it
- No changes to backend validation
- PDF generation handles zero prices gracefully
