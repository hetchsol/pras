# Quick Start: Creating Users Through Frontend

## ✅ **User Management is Already Built Into the Frontend!**

You don't need to run any backend scripts. Everything can be done through the web interface.

---

## How to Create Finance Manager User (2 Minutes)

### Step 1: Login as Admin
```
URL: http://localhost:3000 (or your frontend URL)
Username: admin
Password: admin123
```

### Step 2: Go to Admin Panel
- Click **"Admin"** tab in the top navigation

### Step 3: Create Finance User
1. Click **"+ Add User"** button (top right)
2. Fill in the form:
   ```
   Username:      sarah.banda
   Password:      password123
   Full Name:     Sarah Banda
   Email:         sarah@company.zm
   Role:          Finance (select from dropdown)
   Department:    Finance (select from dropdown)
   Is HOD:        ✓ (check the box)
   ```
3. Click **"Save User"**

### Step 4: Test Login
- Logout from admin
- Login as:
  ```
  Username: sarah.banda
  Password: password123
  ```
- You should see the Finance Manager dashboard with pending requisitions!

---

## Create All Required Users (5 Minutes)

Use the same process to create these users:

### 1. Initiator (Creates Requisitions)
```
Username: john.banda | Password: password123
Role: Initiator | Department: IT
```

### 2. HOD (Approves Department Requisitions)
```
Username: mary.mwanza | Password: password123
Role: HOD | Department: IT | Is HOD: ✓
```

### 3. Procurement (Adds Vendors & Pricing)
```
Username: james.phiri | Password: password123
Role: Procurement | Department: Procurement
```

### 4. Finance Manager (Budget Approval)
```
Username: sarah.banda | Password: password123
Role: Finance | Department: Finance | Is HOD: ✓
```

### 5. MD (Final Approval & PO Generation)
```
Username: david.mulenga | Password: password123
Role: MD | Department: Executive
```

---

## Features Available in Admin Panel

### User Management (Users Tab)
- ✅ **Create** new users with "+ Add User" button
- ✅ **Edit** existing users with "Edit" button
- ✅ **Delete** users with "Delete" button
- ✅ **Reset Passwords** with "Reset Pwd" button
- ✅ **View** all users in sortable table

### Vendor Management (Vendors Tab)
- ✅ Create and manage vendors
- ✅ Edit vendor details
- ✅ Delete vendors

### Department Management (Departments Tab)
- ✅ Create and manage departments
- ✅ Assign department codes

---

## Current System Users (After Running createFinanceUser.js)

| Username | Role | Department | Purpose |
|----------|------|------------|---------|
| admin | Admin | IT | System administration |
| justine.kaluya | Initiator | Operations | Create requisitions |
| joe.munthali | HOD | Operations | Approve Operations reqs |
| anne.banda | HOD | Finance | Approve Finance dept reqs |
| clarence.simwanza | Procurement | Procurement | Add vendors & pricing |
| **sarah.banda** | **Finance** | **Finance** | **Finance approval** ✅ |
| kanyembo.ndhlovu | MD | Executive | Final approval + PO |

---

## Complete Workflow Test

After creating all users, test the complete workflow:

1. **Login as john.banda** → Create & submit requisition
2. **Login as mary.mwanza** → Approve as HOD
3. **Login as james.phiri** → Add vendor & pricing, submit
4. **Login as sarah.banda** → Approve for budget
5. **Login as david.mulenga** → Final approval → PO generated! 🎉

---

## Important Notes

### Backend vs Frontend
- ❌ **DON'T run** `node scripts/createFinanceUser.js` if you've already created the user through UI
- ✅ **DO use** the Admin Panel for all user management going forward
- The backend script was a one-time fix for missing users

### Password Security
- Default passwords are `password123` for all demo users
- ⚠️ **Change these** in production!
- Users should reset their passwords on first login

### Role Permissions
- Only **admin** role can access Admin Panel
- Only **admin** role can create/edit/delete users
- Regular users cannot see the Admin tab

---

## Troubleshooting

**Q: I don't see the Admin tab**
- A: Only users with role=admin can see it. Login as `admin / admin123`

**Q: "+ Add User" button doesn't work**
- A: Make sure you're logged in as admin and on the Users tab

**Q: User created but can't login**
- A: Use "Reset Pwd" button in Admin Panel to reset their password

**Q: Finance user shows "No requisitions found"**
- A: Make sure requisitions have been moved to `pending_finance` status by procurement

---

## Summary

✅ **User management is fully functional in the frontend!**

No backend scripts needed. Just:
1. Login as admin
2. Go to Admin Panel
3. Click "+ Add User"
4. Fill form & save

That's it! The Finance Manager user (and any other user) can be created in under 2 minutes through the UI.

---

**For detailed instructions, see:** `USER_MANAGEMENT_GUIDE.md`

**System Status:** ✅ Ready to use
**Admin Credentials:** `admin / admin123`
**Frontend URL:** http://localhost:3000
