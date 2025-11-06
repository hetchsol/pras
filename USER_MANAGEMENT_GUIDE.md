# User Management Guide - Frontend Interface

## Overview

The Purchase Requisition System includes a fully functional user management interface accessible through the **Admin Panel**. This allows administrators to create, edit, and delete users without needing to run backend scripts.

---

## How to Access User Management

### Step 1: Login as Admin

1. Open the frontend application in your browser
2. Login with admin credentials:
   ```
   Username: admin
   Password: admin123
   ```

### Step 2: Navigate to Admin Panel

1. After logging in, click on the **"Admin"** tab in the top navigation bar
2. You should see tabs for: Users, Vendors, Departments, Department Codes, Reroute
3. The **"Users"** tab should be active by default

---

## Creating a New User

### Step-by-Step Process:

#### 1. Click "+ Add User" Button
   - Located in the top-right of the User Management section
   - This opens the user creation form

#### 2. Fill in User Details

**Required Fields:**
- **Username:** Unique login username (e.g., `sarah.banda`)
- **Password:** User's initial password (min 6 characters)
- **Full Name:** User's display name (e.g., `Sarah Banda`)
- **Email:** User's email address (e.g., `sarah@company.zm`)
- **Role:** Select from dropdown:
  - `initiator` - Creates requisitions
  - `hod` - Approves requisitions (Head of Department)
  - `procurement` - Adds vendor information and pricing
  - `finance` - Finance Manager approval
  - `md` - Managing Director final approval
  - `admin` - Full system access
- **Department:** Select from dropdown:
  - IT
  - HR
  - Finance
  - Operations
  - Procurement
  - Executive

**Optional Fields:**
- **Is HOD:** Check if this user is a Head of Department

#### 3. Click "Save User"
   - User will be created immediately
   - Success message will appear
   - User will appear in the users table below

#### 4. Click "Cancel" to Close Form
   - Or click "Save User" to create another user

---

## Creating the Finance Manager User

### Quick Guide:

1. Login as admin: `admin / admin123`
2. Go to Admin Panel → Users tab
3. Click "+ Add User"
4. Fill in:
   ```
   Username:      sarah.banda
   Password:      password123
   Full Name:     Sarah Banda
   Email:         sarah@company.zm
   Role:          Finance
   Department:    Finance
   Is HOD:        ✓ (checked)
   ```
5. Click "Save User"
6. Done! Finance manager can now login

### Test Login:
```
Username: sarah.banda
Password: password123
```

---

## Creating Users for All Roles

### Recommended Users for Complete Workflow:

#### 1. Initiator
```
Username:      john.banda
Password:      password123
Full Name:     John Banda
Email:         john@company.zm
Role:          Initiator
Department:    IT
Is HOD:        ☐ (unchecked)
```

#### 2. HOD (Head of Department)
```
Username:      mary.mwanza
Password:      password123
Full Name:     Mary Mwanza
Email:         mary@company.zm
Role:          HOD
Department:    IT
Is HOD:        ✓ (checked)
```

#### 3. Procurement Officer
```
Username:      james.phiri
Password:      password123
Full Name:     James Phiri
Email:         james@company.zm
Role:          Procurement
Department:    Procurement
Is HOD:        ☐ (unchecked)
```

#### 4. Finance Manager
```
Username:      sarah.banda
Password:      password123
Full Name:     Sarah Banda
Email:         sarah@company.zm
Role:          Finance
Department:    Finance
Is HOD:        ✓ (checked)
```

#### 5. Managing Director
```
Username:      david.mulenga
Password:      password123
Full Name:     David Mulenga
Email:         david@company.zm
Role:          MD
Department:    Executive
Is HOD:        ☐ (unchecked)
```

---

## Editing Existing Users

### To Edit a User:

1. Find the user in the users table
2. Click the **"Edit"** button (yellow background)
3. User form will open with current details pre-filled
4. Modify any fields except username
5. Click "Save User" to update
6. Click "Cancel" to discard changes

**Note:** You cannot change a user's username after creation. If you need a different username, delete the user and create a new one.

---

## Resetting User Passwords

### To Reset a Password:

1. Find the user in the users table
2. Click the **"Reset Pwd"** button (purple background)
3. A modal will appear
4. Enter the new password (min 6 characters)
5. Click "Reset Password"
6. User can now login with the new password

**Note:** The user will need to be informed of their new password separately.

---

## Deleting Users

### To Delete a User:

1. Find the user in the users table
2. Click the **"Delete"** button (red background)
3. Confirm the deletion in the popup
4. User will be permanently deleted

**Important:**
- You cannot delete your own account
- Deleted users cannot be recovered
- All data associated with the user remains (requisitions they created, etc.)

---

## User Table Columns

The users table displays:

| Column | Description |
|--------|-------------|
| **Username** | Login username |
| **Full Name** | User's display name |
| **Email** | Contact email |
| **Role** | User's role (blue badge) |
| **Department** | User's department |
| **Actions** | Edit, Delete, Reset Password buttons |

---

## Available Roles and Permissions

### Role Details:

| Role | Dashboard View | Can Approve | Special Actions |
|------|---------------|-------------|-----------------|
| **Initiator** | Own requisitions | No | Create, Submit requisitions |
| **HOD** | Department reqs with `pending_hod` | Yes (pending_hod) | Approve/Reject dept requisitions |
| **Procurement** | All `pending_procurement` | No | Add vendors, pricing |
| **Finance** | All `pending_finance` | Yes (pending_finance) | Approve/Reject for budget |
| **MD** | All `pending_md` | Yes (pending_md) | Final approval + PO generation |
| **Admin** | All requisitions | Yes (all stages) | Full access + user management |

---

## Department Options

Currently available departments:
- **IT** - Information Technology
- **HR** - Human Resources
- **Finance** - Finance Department
- **Operations** - Operations Department
- **Procurement** - Procurement Department
- **Executive** - Executive Management

**Note:** HOD users will only see requisitions from their own department.

---

## Best Practices

### Security:
1. **Change Default Passwords:** After creating users, inform them to change their password on first login
2. **Use Strong Passwords:** Minimum 6 characters, but recommend 8+ with mix of letters and numbers
3. **Limit Admin Accounts:** Only create admin accounts for trusted personnel
4. **Regular Audits:** Periodically review user list and remove inactive users

### Organization:
1. **Consistent Naming:** Use firstname.lastname format for usernames
2. **Department Assignment:** Ensure users are assigned to correct departments
3. **Role Assignment:** Assign the most restrictive role necessary
4. **HOD Flag:** Only check "Is HOD" for actual department heads

### Documentation:
1. **Keep Records:** Maintain a list of all users and their roles
2. **Onboarding:** Document the user creation process for new admins
3. **Password Policy:** Establish and communicate password requirements

---

## Troubleshooting

### Issue: "Failed to create user"

**Possible Causes:**
1. Username already exists
2. Missing required fields
3. Invalid email format
4. Password too short (< 6 characters)

**Solution:**
- Check all required fields are filled
- Try a different username
- Ensure email format is valid (name@domain.com)
- Use password with at least 6 characters

### Issue: User created but can't login

**Possible Causes:**
1. Password was typed incorrectly
2. Caps Lock is on
3. Username has extra spaces

**Solution:**
1. Reset the user's password through Admin Panel
2. Inform user of the new password
3. Ensure they're typing credentials exactly as created

### Issue: Can't see Admin Panel

**Possible Causes:**
1. User doesn't have admin role
2. Not logged in

**Solution:**
1. Only users with role=admin can access Admin Panel
2. Login with admin credentials
3. Create another admin user if needed

---

## API Endpoints Used

The frontend user management uses these backend endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create new user |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| PUT | `/api/admin/users/:id/reset-password` | Reset password |

All endpoints require authentication and admin role.

---

## Example Workflow: Setting Up Complete System

### Initial Setup (One-time):

1. **Login as default admin:**
   ```
   Username: admin
   Password: admin123
   ```

2. **Create Finance Manager:**
   - Go to Admin Panel → Users
   - Click "+ Add User"
   - Fill: sarah.banda, Finance role, Finance dept
   - Save

3. **Create MD:**
   - Click "+ Add User"
   - Fill: david.mulenga, MD role, Executive dept
   - Save

4. **Create Procurement Officer:**
   - Click "+ Add User"
   - Fill: james.phiri, Procurement role, Procurement dept
   - Save

5. **Create HODs for each department:**
   - IT HOD: mary.mwanza
   - Operations HOD: joe.munthali
   - Finance HOD: anne.banda

6. **Create Initiators:**
   - IT Initiator: john.banda
   - Operations Initiator: justine.kaluya

### Testing:

1. Logout from admin account
2. Login as john.banda (initiator)
3. Create and submit a requisition
4. Login as mary.mwanza (HOD)
5. Approve the requisition
6. Login as james.phiri (procurement)
7. Add vendor and pricing, submit
8. Login as sarah.banda (finance)
9. Approve for budget
10. Login as david.mulenga (MD)
11. Final approval - PO generated!

---

## Summary

✅ **User management is fully functional through the frontend!**

- No need to run backend scripts
- Admins can create users through UI
- All roles supported: Initiator, HOD, Procurement, Finance, MD, Admin
- Password reset capability included
- User editing and deletion available

**To create the Finance Manager user:**
1. Login as admin
2. Admin Panel → Users → "+ Add User"
3. Fill: `sarah.banda`, role `Finance`, dept `Finance`
4. Save!

---

**Last Updated:** October 30, 2025
**Status:** ✅ Fully Functional
**Access:** Admin role required
