# Purchase Orders - Quick Reference Guide

## ✅ Implementation Complete!

Purchase Orders are now automatically generated when MD approves requisitions and are accessible through a new "Purchase Orders" section.

---

## How to Access Purchase Orders

### 1. Login to System
- Use your credentials to login

### 2. Navigate to Purchase Orders
- Click **"📄 Purchase Orders"** in the left sidebar
- Located between "Requisitions" and "Budgets"

### 3. View Your POs
- See table with all POs you have access to
- Click **"⬇️ Download PDF"** to download any PO

---

## Who Can See What?

| Your Role | What You See |
|-----------|--------------|
| **Procurement** | All Purchase Orders (to distribute to vendors) |
| **Finance** | All Purchase Orders (for financial oversight) |
| **MD** | All Purchase Orders (executive view) |
| **HOD** | Only POs from requisitions you approved |
| **Initiator** | Only POs from your own requisitions |
| **Admin** | All Purchase Orders |

---

## How POs Are Created

**Automatic Process:**

1. Initiator creates requisition → Submit
2. HOD approves → Moves to Procurement
3. Procurement adds pricing → Moves to Finance
4. Finance approves → Moves to MD
5. **MD approves → PO automatically generated!** ✅

**PO Number Format:** `PO-202510-KSB-IT-JB-20251030123456`

---

## How to Download a PO

1. Go to "Purchase Orders" in sidebar
2. Find the PO you want in the table
3. Click the blue **"⬇️ Download PDF"** button
4. PDF will download automatically
5. Open the PDF to view complete details

---

## What's in the PDF?

The PO PDF includes:

- **Header:** PO Number and Date
- **From:** Company Information (Kabwe Sugar Brokerage Ltd)
- **To:** Vendor Information (name, email, phone)
- **Requisition Details:** Req #, Description, Department, Delivery, Date, Urgency
- **Items Table:** Item names, quantities, unit prices, totals
- **Grand Total:** Total amount in ZMW
- **Approval Chain:** Complete list of who approved (HOD, Procurement, Finance, MD)
- **Footer:** Generation timestamp

---

## Testing the System

### Quick Test (5 minutes):

1. **Create Requisition** (as Initiator)
   - Login: `john.banda / password123`
   - Create & submit requisition

2. **Approve as HOD**
   - Login: `mary.mwanza / password123`
   - Approve requisition

3. **Process as Procurement**
   - Login: `james.phiri / password123`
   - Add vendor & pricing, submit

4. **Approve as Finance**
   - Login: `sarah.banda / password123`
   - Approve requisition

5. **Final Approval as MD**
   - Login: `david.mulenga / password123`
   - Approve requisition
   - **PO is automatically created!**

6. **View PO** (as any role)
   - Click "Purchase Orders" in sidebar
   - See the new PO in table
   - Click "Download PDF"
   - Open and verify PDF content

---

## Troubleshooting

**Q: I don't see "Purchase Orders" in the sidebar**
- **A:** Make sure you're logged in as one of these roles: Initiator, HOD, Procurement, Finance, MD, or Admin

**Q: "No Purchase Orders Found" message**
- **A:** No requisitions have been fully approved by MD yet. Complete the workflow above to generate your first PO.

**Q: I can't see a specific PO**
- **A:** You may not have access to that PO based on your role:
  - Initiators only see their own POs
  - HODs only see POs they approved
  - Procurement/Finance/MD/Admin see all POs

**Q: PDF download isn't working**
- **A:** Check your browser's download settings and popup blocker. Try a different browser if the issue persists.

---

## System URLs

- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:3000 (or your configured URL)
- **API Health Check:** http://localhost:3001/api/health

---

## Default Login Credentials

```
Initiator:   john.banda      / password123
HOD:         mary.mwanza     / password123
Procurement: james.phiri     / password123
Finance:     sarah.banda     / password123
MD:          david.mulenga   / password123
Admin:       admin           / admin123
```

---

## Features Summary

✅ **Automatic PO Generation** - Created when MD approves
✅ **Role-Based Access** - Users see only relevant POs
✅ **PDF Download** - Professional format with all details
✅ **Sidebar Navigation** - Easy access from any page
✅ **Audit Trail** - All downloads logged
✅ **Security** - Access controlled by backend

---

## Support

For detailed documentation, see:
- `PURCHASE_ORDERS_IMPLEMENTATION.md` - Complete technical documentation
- `WORKFLOW_GUIDE.md` - Full workflow explanation

---

**Last Updated:** October 30, 2025
**Status:** ✅ Fully Operational
**Version:** 1.0
