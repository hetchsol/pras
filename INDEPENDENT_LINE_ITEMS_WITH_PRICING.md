# Independent Line Items with Pricing Feature

## Overview
Each line item in a purchase requisition is now completely independent with its own pricing. The system automatically calculates subtotals, VAT (16%), and grand total for the entire requisition.

## Key Concept
- **Each item is separate** - Has its own description, quantity, and unit price
- **Item total** = Quantity × Unit Price
- **Requisition subtotal** = Sum of all item totals
- **VAT** = Subtotal × 16%
- **Grand Total** = Subtotal + VAT

## Changes Made

### Frontend Changes (`frontend/app.js`)

#### 1. Line Item Structure (Line 2198)
```javascript
const [lineItems, setLineItems] = useState([
  { item_name: '', quantity: 1, unit_price: '' }
]);
```

Each item now includes:
- `item_name` - Description of the item
- `quantity` - Number of units
- `unit_price` - Price per unit in ZMW

#### 2. Totals Calculation Function (Lines 2256-2265)
```javascript
const calculateTotals = () => {
  const subtotal = lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return sum + (qty * price);
  }, 0);
  const vat = subtotal * 0.16; // 16% VAT
  const grandTotal = subtotal + vat;
  return { subtotal, vat, grandTotal };
};
```

#### 3. Data Submission (Lines 2297-2309 & 2366-2378)
When saving or submitting, each item is enriched with:
```javascript
{
  item_name: item.item_name,
  quantity: qty,
  unit_price: price,
  total_price: qty * price,  // Calculated for each item
  specifications: formData.justification,
  currency: 'ZMW'
}
```

#### 4. UI Layout (Lines 2472-2518)

**Three-Column Grid:**
- Column 1: Item Description
- Column 2: Quantity
- Column 3: Unit Price (ZMW)

**Item Total Display:**
- Shows "Item Total: ZMW X,XXX.XX" below each item
- Updates in real-time as quantity or price changes

**Totals Summary Panel (Lines 2523-2545):**
- Blue background panel with summary
- Shows Subtotal, VAT (16%), and Grand Total
- Updates automatically as items change

## Form Layout

```
┌─────────────────────────────────────────────────────────┐
│  Line Items (2/15)                   [Add Item ➕]      │
├─────────────────────────────────────────────────────────┤
│  Item 1                                   [Remove 🗑️]   │
│  ┌────────────────┬──────────┬────────────────────────┐ │
│  │ Description*   │ Qty*     │ Unit Price (ZMW)*      │ │
│  │ Laptops        │ 5        │ 15000.00               │ │
│  └────────────────┴──────────┴────────────────────────┘ │
│  Item Total: ZMW 75,000.00                              │
├─────────────────────────────────────────────────────────┤
│  Item 2                                   [Remove 🗑️]   │
│  ┌────────────────┬──────────┬────────────────────────┐ │
│  │ Description*   │ Qty*     │ Unit Price (ZMW)*      │ │
│  │ Mice           │ 10       │ 350.00                 │ │
│  └────────────────┴──────────┴────────────────────────┘ │
│  Item Total: ZMW 3,500.00                               │
├─────────────────────────────────────────────────────────┤
│  Item 3                                   [Remove 🗑️]   │
│  ┌────────────────┬──────────┬────────────────────────┐ │
│  │ Description*   │ Qty*     │ Unit Price (ZMW)*      │ │
│  │ Keyboards      │ 5        │ 800.00                 │ │
│  └────────────────┴──────────┴────────────────────────┘ │
│  Item Total: ZMW 4,000.00                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  💰 Requisition Totals                                  │
│  Subtotal:                           ZMW 82,500.00      │
│  VAT (16%):                          ZMW 13,200.00      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Grand Total:                        ZMW 95,700.00      │
└─────────────────────────────────────────────────────────┘

Date Required*  │  Current Date
Urgency Level*
Justification for Requisition*

[Submit for Approval] [Save as Draft] [Cancel]
```

## Calculation Flow

### Example with 3 Items:

**Item 1:** Laptops
- Quantity: 5
- Unit Price: 15,000.00 ZMW
- **Item Total: 75,000.00 ZMW**

**Item 2:** Mice
- Quantity: 10
- Unit Price: 350.00 ZMW
- **Item Total: 3,500.00 ZMW**

**Item 3:** Keyboards
- Quantity: 5
- Unit Price: 800.00 ZMW
- **Item Total: 4,000.00 ZMW**

**Requisition Totals:**
- **Subtotal:** 75,000 + 3,500 + 4,000 = **82,500.00 ZMW**
- **VAT (16%):** 82,500 × 0.16 = **13,200.00 ZMW**
- **Grand Total:** 82,500 + 13,200 = **95,700.00 ZMW**

## Database Storage

### requisition_items Table
Each item is stored independently with its own pricing:

```sql
-- Item 1
INSERT INTO requisition_items (
  requisition_id, item_name, quantity, unit_price,
  total_price, currency, specifications
) VALUES (
  1, 'Laptops', 5, 15000.00, 75000.00, 'ZMW',
  'IT department upgrade needed'
);

-- Item 2
INSERT INTO requisition_items (
  requisition_id, item_name, quantity, unit_price,
  total_price, currency, specifications
) VALUES (
  1, 'Mice', 10, 350.00, 3500.00, 'ZMW',
  'IT department upgrade needed'
);

-- Item 3
INSERT INTO requisition_items (
  requisition_id, item_name, quantity, unit_price,
  total_price, currency, specifications
) VALUES (
  1, 'Keyboards', 5, 800.00, 4000.00, 'ZMW',
  'IT department upgrade needed'
);
```

## Features

### 1. **Real-Time Calculations**
- Item totals update immediately when quantity or price changes
- Subtotal, VAT, and Grand Total recalculate automatically
- No need to click "Calculate" button

### 2. **Independent Item Pricing**
- Each item has its own unit price
- Different items can have vastly different prices
- Items are truly independent of each other

### 3. **Visual Feedback**
- Individual item totals shown below each item
- Summary panel clearly shows breakdown
- Blue highlighting for totals section

### 4. **Validation**
- Requires at least one item with unit price for submission
- Unit prices must be positive numbers
- Quantity must be at least 1

### 5. **Number Formatting**
- All currency values formatted with 2 decimal places
- Thousands separators for readability (e.g., 75,000.00)
- Consistent ZMW currency display

## PDF Generation

The fixed PO PDF generator (from previous update) will display:
- Each item with its quantity, unit price, and amount
- Subtotal (sum of all item amounts)
- VAT (16% of subtotal)
- Grand Total (subtotal + VAT)

## Validation Rules

### Save as Draft
- ✅ At least one item with description
- ✅ Date required
- ⚠️ Unit prices optional (can be 0)
- ⚠️ Justification optional

### Submit for Approval
- ✅ At least one item with description
- ✅ Date required
- ✅ **At least one item must have unit price > 0**
- ✅ Justification required
- ✅ HOD selection (if procurement)

## Backend Compatibility

✅ **No backend changes needed** - The backend already:
- Accepts `unit_price` and `total_price` in items array
- Stores each item independently in `requisition_items` table
- PDF generator calculates totals from stored item data

## Testing Instructions

### Test 1: Add Multiple Items with Different Prices
1. Add Item 1: "Laptops", Qty: 5, Price: 15000
2. Verify Item Total shows: ZMW 75,000.00
3. Add Item 2: "Mice", Qty: 10, Price: 350
4. Verify Item Total shows: ZMW 3,500.00
5. Check Totals Summary:
   - Subtotal: ZMW 78,500.00
   - VAT (16%): ZMW 12,560.00
   - Grand Total: ZMW 91,060.00

### Test 2: Real-Time Updates
1. Change Laptop quantity from 5 to 10
2. Verify Item Total updates to: ZMW 150,000.00
3. Verify Subtotal updates to: ZMW 153,500.00
4. Verify VAT updates to: ZMW 24,560.00
5. Verify Grand Total updates to: ZMW 178,060.00

### Test 3: Submission with Pricing
1. Fill all item prices
2. Add justification
3. Submit requisition
4. Check database: verify all items have correct unit_price and total_price
5. Download PDF: verify all pricing displays correctly

## Files Modified
- `frontend/app.js` (Lines 2197-2545)

## Benefits

✅ **Independent Items** - Each item completely separate
✅ **Accurate Costing** - Per-item pricing with automatic totals
✅ **Transparent Calculations** - Shows subtotal, VAT, grand total
✅ **Real-Time Feedback** - Instant updates as you type
✅ **Professional Display** - Clear formatting with totals panel
✅ **Database Ready** - Each item stored with full pricing data
✅ **PDF Compatible** - Fixed PDF generator displays all pricing

## Notes
- VAT rate is fixed at 16% (Zambian standard)
- All prices in ZMW (Zambian Kwacha)
- Unit prices accept decimals (e.g., 350.50)
- Totals calculated client-side for instant feedback
- Final calculations done server-side when saving
