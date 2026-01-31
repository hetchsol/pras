# Simplified Multi-Line Items Feature

## Overview
Updated the purchase requisition form to have a cleaner structure:
- **Line items** contain only Item Description and Quantity
- **Single justification field** applies to the entire requisition (all items)

## Changes Made

### Form Structure

**Before:**
- Each line item had: Item Description, Quantity, and Individual Justification
- Redundant justification for each item

**After:**
- Each line item has: Item Description and Quantity (displayed side-by-side)
- Single "Justification for Requisition" field at the bottom applies to all items

### Updated Components (`frontend/app.js`)

#### 1. State Management (Lines 2190-2199)
```javascript
const [formData, setFormData] = useState({
  dateRequired: '',
  justification: '',  // Single justification for entire requisition
  department: user.department,
  urgency: 'standard',
  selectedHod: ''
});
const [lineItems, setLineItems] = useState([
  { item_name: '', quantity: 1 }  // No specifications field
]);
```

#### 2. Line Item Functions (Lines 2247-2267)
- `addLineItem()` - Creates item with only `item_name` and `quantity`
- `removeLineItem()` - Removes items (min 1 required)
- `updateLineItem()` - Updates item fields

#### 3. Form Submission Logic

**Save as Draft (Lines 2270-2311):**
- Applies `formData.justification` to all items as specifications
- If no justification provided, uses: "Draft - No justification provided yet"
- Allows draft saving without justification

**Submit for Approval (Lines 2313-2372):**
- **Validates justification is required** before submission
- Applies single justification to all items
- Each item gets the same specifications value

#### 4. UI Layout (Lines 2437-2463)
**Line Item Cards:**
- Two-column grid layout for Item Description and Quantity
- More compact and easier to scan
- Remove button on the right (when multiple items)

**Justification Field (Lines 2499-2508):**
- Single textarea field
- Labeled: "Justification for Requisition *"
- Placeholder: "Explain the business need for this requisition and all items listed above..."
- Located after Urgency Level, before HOD selection

## Form Layout

```
┌─────────────────────────────────────────────────┐
│ Auto-Generated Information                      │
│ (PR Number, Department, Dept Code)              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Line Items (3/15)              [Add Item ➕]    │
├─────────────────────────────────────────────────┤
│ Item 1                              [Remove 🗑️] │
│  Item Description*    │  Quantity*               │
│  [Laptops          ]  │  [5       ]              │
├─────────────────────────────────────────────────┤
│ Item 2                              [Remove 🗑️] │
│  Item Description*    │  Quantity*               │
│  [Mice             ]  │  [10      ]              │
├─────────────────────────────────────────────────┤
│ Item 3                              [Remove 🗑️] │
│  Item Description*    │  Quantity*               │
│  [Keyboards        ]  │  [5       ]              │
└─────────────────────────────────────────────────┘

Date Required*        │  Current Date
[2025-11-15]         │  [2025-11-13]

Urgency Level*
[Standard (30 days) ▼]

Justification for Requisition*
┌─────────────────────────────────────────────────┐
│ Required for IT department upgrade. Current     │
│ equipment is outdated and affecting             │
│ productivity...                                 │
└─────────────────────────────────────────────────┘

[HOD Selection] (if procurement role)

[Submit for Approval] [Save as Draft] [Cancel]
```

## Benefits

### 1. **Cleaner UI**
- Less cluttered form
- Easier to scan multiple items
- Two-column layout for line items saves space

### 2. **Simplified Data Entry**
- No need to repeat justification for each item
- Faster to add multiple related items
- Focus on what varies (item name and quantity)

### 3. **Better User Experience**
- Clear separation: "what" (items) vs "why" (justification)
- Single comprehensive justification for entire request
- Less redundant typing

### 4. **Logical Grouping**
- All items in one requisition share the same business need
- Justification explains the context for ALL items together
- More natural workflow

## Validation Rules

### Save as Draft
- ✅ At least one item with description
- ✅ Date required must be filled
- ⚠️ Justification optional (default text added)

### Submit for Approval
- ✅ At least one item with description
- ✅ Date required must be filled
- ✅ **Justification is REQUIRED**
- ✅ HOD selection required (if procurement role)

## Technical Implementation

### Data Flow
```javascript
// User enters:
lineItems = [
  { item_name: 'Laptops', quantity: 5 },
  { item_name: 'Mice', quantity: 10 }
]
formData.justification = "IT department upgrade needed"

// Backend receives:
items = [
  { item_name: 'Laptops', quantity: 5, specifications: "IT department upgrade needed" },
  { item_name: 'Mice', quantity: 10, specifications: "IT department upgrade needed" }
]
```

### Backend Compatibility
✅ **No backend changes required** - The backend expects items with specifications field, which is automatically populated from the single justification.

## Files Modified
- `frontend/app.js` (Lines 2189-2508)

## Testing Instructions

1. **Open Create Requisition Form**
   - Login as initiator
   - Click "Create Requisition"

2. **Add Multiple Items**
   - Fill first item: "Laptops", quantity 5
   - Click "Add Item"
   - Fill second item: "Mice", quantity 10
   - Click "Add Item"
   - Fill third item: "Keyboards", quantity 5

3. **Verify Layout**
   - Items display side-by-side (Description | Quantity)
   - Counter shows "Line Items (3/15)"
   - No individual justification fields on items

4. **Fill Justification**
   - Scroll to "Justification for Requisition"
   - Enter: "Required for IT department upgrade"

5. **Submit**
   - Click "Submit for Approval"
   - Verify requisition created with all 3 items
   - Check database: all items have same specifications value

6. **Test Validation**
   - Try submitting without justification
   - Verify alert: "Please provide a justification for this requisition"

## Comparison

| Feature | Before | After |
|---------|--------|-------|
| Item fields | Description, Quantity, Justification | Description, Quantity |
| Justification | Per item | Single for all items |
| Form length | Longer (repeated fields) | Shorter (no repetition) |
| Data entry | Repetitive | Streamlined |
| Layout | Vertical stack | Two-column grid |
| Validation | Per item specs required | Single justification required |

## Notes
- Justification applies to ALL items in the requisition
- Items are displayed in a compact two-column layout
- Maintains all functionality (add/remove items, max 15)
- Backend receives items with specifications populated from single justification
- PDF generation shows all items correctly
