# New User Created - Finance Department

**Date:** November 19, 2025
**Department:** Finance
**Role:** Initiator

---

## User Credentials

| Field | Value |
|-------|-------|
| **Username** | mwansa.mwelwa |
| **Password** | password123 |
| **Full Name** | Mwansa Mwelwa |
| **Email** | (empty) |
| **Role** | initiator |
| **Department** | Finance |
| **Assigned HOD** | Anne Banda |
| **User ID** | 30 |
| **Created** | November 19, 2025 |

---

## Login Instructions

1. **Access the System:**
   - URL: http://PRAS:3001
   - Or: http://localhost:3001
   - Or: http://192.168.23.114:3001

2. **Login:**
   - Username: `mwansa.mwelwa`
   - Password: `password123`

3. **First Login:**
   - User should change password after first login (if password change feature is implemented)
   - Familiarize with the interface using the User Manual

---

## User Permissions

As an **initiator**, Mwansa Mwelwa has the following permissions:

### ✅ Can Do:
- Create purchase requisitions
- Save requisitions as drafts
- Edit draft requisitions before submission
- Add multiple line items to requisitions
- Submit requisitions for approval (routed to Anne Banda)
- View own requisitions and their status
- View approved purchase orders
- Download PO PDFs
- Access reports (view only)

### ❌ Cannot Do:
- Enter or modify unit prices (Procurement fills this)
- Approve requisitions (requires HOD/Finance/MD role)
- Manage quotes or adjudications
- Modify budgets or FX rates
- Access admin panel
- Edit submitted requisitions

---

## Approval Workflow

Requisitions created by Mwansa Mwelwa will follow this path:

```
1. Mwansa creates requisition
   └─> Saves as draft (can edit)

2. Mwansa submits requisition
   └─> Status: Pending
   └─> Routed to: Anne Banda (Finance HOD)

3. Anne Banda reviews
   ├─> Approves → Routes to Procurement
   └─> Rejects → Mwansa can view (cannot edit)

4. Procurement adds pricing
   └─> Routes to Finance (if above threshold)

5. Finance reviews
   └─> Routes to MD if needed

6. Final approval
   └─> Converts to Purchase Order

7. Mwansa can view and download PO
```

---

## Finance Department Users

Total Finance users: **4**

| Username | Full Name | Role | Assigned HOD |
|----------|-----------|------|--------------|
| anne.banda | Anne Banda | finance | N/A (is HOD) |
| annie.nanyangwe | Annie Nanyangwe | initiator | Anne Banda |
| nason.nguni | Nason Nguni | initiator | Anne Banda |
| **mwansa.mwelwa** | **Mwansa Mwelwa** | **initiator** | **Anne Banda** |

---

## Recent Changes (November 19, 2025)

1. **HOD Assignment Updated:**
   - Annie Nanyangwe: Now has Anne Banda as assigned HOD ✅
   - Nason Nguni: Now has Anne Banda as assigned HOD ✅
   - Mwansa Mwelwa: Created with Anne Banda as assigned HOD ✅

2. **Role Standardization:**
   - All initiator roles normalized to lowercase "initiator"
   - Case-insensitive role checking implemented
   - All 14 initiators now have identical permissions

---

## System Access Points

### For Mwansa Mwelwa:

**Primary Functions:**
- Dashboard: View requisition summary
- Create Requisition: Submit new purchase requests
- My Requisitions: View/track all created requisitions
- Approved Requisitions: View purchase orders
- Reports: View department reports

**Navigation:**
- Sidebar menu shows available options
- "Create Requisition" button for new requests
- Filter requisitions by status (draft, pending, approved, rejected)

---

## Training Resources

**Available Documentation:**
- `USER_MANUAL_INITIATOR.md` - Complete user guide for initiators
- `MULTI_LINE_ITEMS_FEATURE.md` - How to add multiple items
- `INITIATOR_ROLE_STANDARDIZATION.md` - Role permissions reference

**Key Features to Learn:**
1. Creating requisitions with multiple line items
2. Saving drafts for later completion
3. Submitting requisitions for approval
4. Tracking requisition status
5. Viewing approved purchase orders

---

## Support

**For Issues:**
- Check user manual first
- Contact system administrator
- Review role standardization document

**Common Questions:**
- **Q:** Why can't I enter unit prices?
  - **A:** Unit prices are filled by Procurement department after submission

- **Q:** Where does my requisition go after submission?
  - **A:** It routes to your assigned HOD (Anne Banda for Finance)

- **Q:** Can I edit after submission?
  - **A:** No, requisitions are locked after submission for audit purposes

---

## Security Notes

⚠️ **Important:**
- Change default password on first login (recommended)
- Do not share credentials with other users
- Log out after each session
- Report any suspicious activity

---

**User Status:** ✅ ACTIVE
**Ready to Use:** YES
**System Access:** GRANTED

---

**Created by:** System Administrator
**Date:** November 19, 2025
**System:** Purchase Requisition System v3.0
