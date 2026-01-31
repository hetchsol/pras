# New User Credentials - Quick Reference

**System:** Purchase Requisition Approval System (PRAS)
**Date Created:** November 18, 2025
**Default Password:** `password123` (for all users)

---

## Login Instructions

1. Navigate to: http://localhost:3001 (or your server URL)
2. Enter your username (without @)
3. Enter password: `password123`
4. **Important:** Change your password after first login

---

## User Credentials by Department

### 🏭 Operations Department
**HOD:** Joel Munthali

| Full Name | Username | Role |
|-----------|----------|------|
| Hillary Chaponda | `hillary.chaponda` | Initiator |
| Bernard Kalimba | `bernard.kalimba` | Initiator |
| John Chabala | `john.chabala` | Initiator |

---

### 💼 Sales Department
**HOD:** Moses Shebele

| Full Name | Username | Role |
|-----------|----------|------|
| Moses Shebele | `moses.shebele` | **HOD** |
| Larry Mwambazi | `larry.mwambazi` | **HOD** |
| Mwaka Musonda | `mwaka.musonda` | Initiator |
| Dickson Chipwalu | `dickson.chipwalu` | Initiator |
| Waden Chishimba | `waden.chishimba` | Initiator |
| Ashley Rabie | `ashley.rabie` | Initiator |
| Lina Zimba | `lina.zimba` | Initiator |

---

### 👥 HR Department
**HOD:** Kanyembo Ndhlovu

| Full Name | Username | Role |
|-----------|----------|------|
| Mbialesi Namute | `mbialesi.namute` | Initiator |

---

### 📦 Stores Department
**HOD:** Anne Banda

| Full Name | Username | Role |
|-----------|----------|------|
| Moses Phiri | `moses.phiri` | Initiator |

---

### 💰 Finance Department
**HOD:** *(None assigned)*

| Full Name | Username | Role |
|-----------|----------|------|
| Annie Nanyangwe | `annie.nanyangwe` | Initiator |
| Nason Nguni | `nason.nguni` | Initiator |

---

## Role Descriptions

### Initiator
- Create purchase requisitions
- Submit requisitions for approval
- View own requisitions
- Track requisition status

### HOD (Head of Department)
- All Initiator privileges
- Approve/reject requisitions from department
- View department requisitions
- Add comments and recommendations

---

## Tax Type Selection Guide

When creating a requisition, you must select the tax type:

### VAT (16% Tax)
- Select this for suppliers who are VAT-registered
- System will add 16% tax to the subtotal
- **Example:** ZMW 1,000 + 16% = ZMW 1,160

### TOT (No Tax)
- Select this for TOT-registered suppliers
- No tax will be calculated
- **Example:** ZMW 1,000 + No Tax = ZMW 1,000

**Note:** The tax type you select will appear on the PDF when the requisition is approved.

---

## Quick Start Guide

### Creating a Requisition

1. **Login** with your credentials
2. Click **"Create Requisition"**
3. **Add line items:**
   - Item description
   - Quantity
   - Unit price (if you're procurement)
4. **Select required date**
5. **Choose urgency level**
6. **Select tax type** (VAT or TOT)
7. **Provide justification**
8. Click **"Submit for Approval"**

### Approving a Requisition (HODs only)

1. **Login** with HOD credentials
2. View **"Pending Approvals"**
3. Click on a requisition to review
4. **Approve** or **Reject** with comments
5. Requisition moves to next approval stage

---

## Support

If you experience any issues:
- Contact IT Support
- Email: support@ksb.com
- Or contact your department HOD

---

## Security Reminders

- ✅ Keep your password confidential
- ✅ Change default password on first login
- ✅ Log out when finished
- ✅ Don't share your credentials
- ✅ Report suspicious activity immediately

---

**System Status:** ✅ All users active and ready to use
**Backend Server:** Running on http://localhost:3001
