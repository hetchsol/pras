# Multi-Line Items Feature Implementation

## Overview
Implemented a dynamic line items feature in the purchase requisition creation form, allowing initiators to add up to 15 items per requisition.

## Changes Made

### Frontend Changes (`frontend/app.js`)

#### 1. Updated State Management (Lines 2190-2198)
**Before:**
```javascript
const [formData, setFormData] = useState({
  description: '',
  quantity: 1,
  dateRequired: '',
  justification: '',
  department: user.department,
  urgency: 'standard',
  selectedHod: ''
});
```

**After:**
```javascript
const [formData, setFormData] = useState({
  dateRequired: '',
  department: user.department,
  urgency: 'standard',
  selectedHod: ''
});
const [lineItems, setLineItems] = useState([
  { item_name: '', quantity: 1, specifications: '' }
]);
```

#### 2. Added Line Item Management Functions (Lines 2246-2267)
- `addLineItem()` - Adds a new line item (max 15 items)
- `removeLineItem(index)` - Removes a line item (minimum 1 required)
- `updateLineItem(index, field, value)` - Updates individual line item fields

#### 3. Updated Form Submission Logic
**Save as Draft Handler (Lines 2269-2304):**
- Validates at least one item with description
- Filters out empty items
- Sends array of valid items to backend

**Submit for Approval Handler (Lines 2306-2354):**
- Validates at least one item with description AND specifications
- Ensures all items have justification before submission
- Sends array of valid items to backend

#### 4. Updated UI (Lines 2385-2492)
**New Line Items Section:**
- Shows counter: "Line Items (X/15)"
- Green "Add Item" button (disabled at 15 items)
- Each item card includes:
  - Item number display (Item 1, Item 2, etc.)
  - Remove button (only when multiple items exist)
  - Item Description field
  - Quantity field
  - Justification/Specifications textarea
- Visual distinction with dashed border and gray background

**Simplified General Details:**
- Removed single item fields
- Kept: Date Required, Current Date, Urgency Level
- HOD selection still available for procurement role

## Features

### For Initiators
1. **Add Multiple Items**: Click "Add Item" button to add up to 15 line items
2. **Remove Items**: Click remove button (🗑️) on individual items (minimum 1 required)
3. **Individual Specifications**: Each item can have its own description, quantity, and justification
4. **Visual Feedback**: Counter shows current items vs. maximum (e.g., "Line Items (3/15)")
5. **Smart Validation**:
   - Draft save requires at least description
   - Submission requires description AND specifications for each item

### User Experience Improvements
- **Clear Visual Hierarchy**: Line items section is visually separated with dashed border
- **Intuitive Controls**: Add/Remove buttons with icons
- **Responsive Layout**: Each item card clearly labeled and organized
- **Disabled States**: Add button disabled at maximum capacity
- **Required Field Indicators**: All fields marked with * are validated

## Backend Compatibility

The backend endpoint `/api/requisitions/simple` already supports multiple items:
```javascript
items: [
  { item_name: 'Item 1', quantity: 5, specifications: 'Details...' },
  { item_name: 'Item 2', quantity: 2, specifications: 'Details...' }
]
```

No backend changes were required for this feature.

## Testing

### Test Scenario 1: Add Multiple Items
1. Login as initiator
2. Click "Create Requisition"
3. Click "Add Item" multiple times
4. Verify counter updates (1/15, 2/15, etc.)
5. Verify button disables at 15 items

### Test Scenario 2: Remove Items
1. Add 3 items
2. Click remove on 2nd item
3. Verify item is removed and counter updates
4. Try to remove when only 1 item remains
5. Verify alert: "At least one line item is required"

### Test Scenario 3: Submit with Multiple Items
1. Add 3 items with different descriptions, quantities, and justifications
2. Fill required date and urgency
3. Click "Submit for Approval"
4. Verify requisition is created with all 3 items
5. Check database: requisition_items table should have 3 entries

### Test Scenario 4: Validation
1. Leave all items empty, try to submit
2. Verify alert: "Please add at least one item with description and justification"
3. Fill only description without justification
4. Verify alert appears
5. Fill all fields correctly
6. Verify successful submission

## Files Modified
- `frontend/app.js` (Lines 2189-2492)

## Database Schema
The feature uses existing `requisition_items` table:
```sql
CREATE TABLE requisition_items (
  id INTEGER PRIMARY KEY,
  requisition_id INTEGER,
  item_name TEXT,
  quantity INTEGER,
  unit_price REAL,
  total_price REAL,
  specifications TEXT,
  vendor_id INTEGER,
  currency TEXT,
  amount_in_zmw REAL,
  fx_rate_used REAL,
  created_at DATETIME
)
```

## Benefits
1. **Flexibility**: Users can requisition multiple different items in one request
2. **Efficiency**: No need to create separate requisitions for each item
3. **Better Tracking**: All related items grouped under one requisition number
4. **Accurate Budgeting**: Total cost reflects all items
5. **Improved PDF Reports**: All items display in approved requisition PDFs

## Screenshots Locations
The UI shows:
- Line items counter in header
- Green "Add Item" button
- Individual item cards with remove buttons
- All fields properly labeled and validated

## Notes
- Maximum of 15 items enforced
- Minimum of 1 item required
- Each item can have unique specifications
- Backend already supports this structure via `/api/requisitions/simple`
- PDF generation already handles multiple items (fixed in previous update)
