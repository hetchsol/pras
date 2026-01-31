# User Manual - Initiator Role

**Purchase Requisition System v3.0**

---

## Your Role

As an **Initiator**, you create and submit purchase requisitions.

### Responsibilities
- Create new requisitions
- Submit for approval
- Track requisition status
- View reports

---

## Getting Started

### Login
1. Open browser: **http://localhost:3000**
2. Username: `john.banda` (or your username)
3. Password: `password123`
4. Change password after first login

---

## Creating a Requisition

### Step 1: Click "Create Requisition"

### Step 2: Fill Basic Details
- **Title**: Brief description
- **Department**: Your department
- **Budget Code**: Cost center
- **Priority**: Normal/Urgent/Critical
- **Required By**: Delivery date

### Step 3: Add Items
- Item name and description
- Quantity and unit
- Unit price and currency
- Specifications
- Justification

### Step 4: Attach Documents
- Vendor quotes
- Specifications
- Supporting documents

### Step 5: Submit
- **Save as Draft**: Edit later
- **Submit for Approval**: Send to HOD

---

## Requisition Status

| Status | Meaning |
|--------|---------|
| Draft | Not yet submitted |
| Pending HOD | Awaiting HOD approval |
| HOD Approved | Approved by HOD, sent to Finance |
| Finance Approved | Approved by Finance, sent to MD |
| MD Approved | Approved by MD, sent to Procurement |
| In Procurement | Being processed |
| PO Issued | Purchase Order created |
| Completed | Items delivered |
| Rejected | Rejected at any stage |

---

## Approval Workflow

```
You (Initiator) → HOD → Finance → MD → Procurement → PO → Delivery
```

---

## Viewing Your Requisitions

1. Click "My Requisitions"
2. View all your requests
3. Click "View" to see details
4. Check approval history and comments

---

## Tips for Success

### Good Justification Example
```
Need 2 laptops for Finance team because:
1. Current laptops are 5 years old
2. New software requires better specs
3. Downtime costs K500/day
4. For 2 new staff starting Q1
```

### What to Attach
- Vendor quotations
- Product specifications
- Price comparisons
- Budget approvals

---

## Troubleshooting

**Cannot login?**
- Check username/password
- Clear browser cache
- Try different browser

**Cannot submit?**
- Fill all required fields
- Add at least one item
- Check prices entered

**Upload failed?**
- Max file size: 10 MB
- Formats: PDF, JPG, PNG, DOC, XLS

---

## Contact Support

**IT Support**
- Email: support@company.com
- Phone: +260-XXX-XXXX
- Hours: Mon-Fri, 8AM-5PM

---

**End of Initiator Manual**
