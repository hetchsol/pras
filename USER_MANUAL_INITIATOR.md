# 📘 User Manual - Initiator Role

**Purchase Requisition System**
**Version:** 3.0
**Role:** Initiator
**Last Updated:** January 6, 2025

---

## 👤 About Your Role

As an **Initiator**, you are the starting point of the purchase requisition process. Your primary responsibilities include:

- ✅ Creating new purchase requisitions
- ✅ Submitting items for approval
- ✅ Tracking your requisitions
- ✅ Viewing requisition status
- ✅ Updating your profile

---

## 🚀 Getting Started

### Step 1: Access the System

1. Open your web browser (Chrome, Edge, or Firefox recommended)
2. Navigate to: **http://localhost:3000**
3. You will see the login screen

### Step 2: Login

**Your Default Credentials:**
- **Username:** `john.banda` (or your assigned username)
- **Password:** `password123` (change this after first login)

**Login Steps:**
1. Enter your username
2. Enter your password
3. Click "Login"
4. You will be directed to your dashboard

### Step 3: Change Your Password (First Login)

1. Click on your name in the top-right corner
2. Select "Profile"
3. Click "Change Password"
4. Enter current password: `password123`
5. Enter new password (minimum 8 characters)
6. Confirm new password
7. Click "Update Password"

---

## 📊 Understanding Your Dashboard

### Dashboard Overview

Your dashboard shows:

**Quick Stats:**
- Total requisitions you've created
- Pending approvals
- Approved requisitions
- Rejected requisitions

**Recent Requisitions Table:**
- Requisition number
- Date created
- Status (Draft, Pending, Approved, Rejected)
- Total amount
- Actions (View, Edit, Delete)

**Quick Actions:**
- Create New Requisition (+ button)
- View All Requisitions
- Filter by status

---

## ✍️ Creating a New Requisition

### Step-by-Step Process

#### Step 1: Start New Requisition

1. Click the **"+ Create Requisition"** button
2. You'll see the requisition form

#### Step 2: Fill Basic Information

**Requisition Details:**

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Brief description of request | "Office Supplies for Q1" |
| **Department** | Your department | "Finance" |
| **Budget Code** | Cost center/budget code | "FIN-2025-001" |
| **Priority** | Urgency level | Normal / Urgent / Critical |
| **Required By** | When you need items | 2025-02-15 |

**Tips:**
- ✅ Use clear, descriptive titles
- ✅ Select correct department
- ✅ Choose appropriate priority
- ✅ Set realistic delivery dates

#### Step 3: Add Items

1. Click **"+ Add Item"** button
2. Fill item details:

| Field | Required | Description |
|-------|----------|-------------|
| **Item Name** | Yes | Name of item/service |
| **Description** | Yes | Detailed description |
| **Quantity** | Yes | Number of units |
| **Unit** | Yes | Each, Box, Pack, etc. |
| **Unit Price** | Yes | Price per unit (ZMW) |
| **Currency** | Yes | ZMW or USD |
| **Specifications** | No | Technical specs |
| **Justification** | Yes | Why you need this |

**Example:**

```
Item Name: HP LaserJet Printer
Description: Black & white laser printer for office use
Quantity: 2
Unit: Each
Unit Price: 3500
Currency: ZMW
Specifications: Minimum 30 pages/min, duplex printing
Justification: Current printers are outdated and frequently breaking down
```

3. Click **"Add Item"**
4. Repeat for all items needed
5. You can add multiple items to one requisition

**To Edit an Item:**
- Click the pencil icon next to the item
- Make changes
- Click "Update"

**To Remove an Item:**
- Click the trash icon next to the item
- Confirm deletion

#### Step 4: Upload Supporting Documents (Optional)

1. Scroll to "Attachments" section
2. Click **"Choose File"** or drag and drop
3. Supported formats: PDF, JPG, PNG, Excel, Word
4. Maximum size: 10 MB per file
5. You can upload multiple files

**Common Documents to Attach:**
- Quotations from vendors
- Product specifications
- Price comparisons
- Budget approvals
- Authorization letters

#### Step 5: Review Your Requisition

Before submitting, verify:

- ✅ All required fields filled
- ✅ Item quantities correct
- ✅ Prices accurate
- ✅ Total amount calculated correctly
- ✅ Justifications clear
- ✅ Supporting documents attached

**Total Amount:**
The system automatically calculates:
- Subtotal (all items)
- Tax (if applicable)
- Grand Total

#### Step 6: Save or Submit

You have two options:

**Option 1: Save as Draft**
- Click **"Save as Draft"**
- Requisition saved for later
- You can edit anytime
- Not sent for approval

**Option 2: Submit for Approval**
- Click **"Submit for Approval"**
- Requisition sent to your HOD
- Status changes to "Pending HOD Approval"
- You'll receive confirmation
- Cannot edit after submission

---

## 📋 Managing Your Requisitions

### Viewing All Requisitions

1. Click **"My Requisitions"** in the menu
2. You'll see a list of all your requisitions

**Table Columns:**
- **Req. No.** - Unique requisition number
- **Date** - Creation date
- **Title** - Requisition description
- **Status** - Current approval status
- **Amount** - Total amount
- **Actions** - View/Edit/Delete buttons

### Understanding Requisition Status

| Status | What It Means | What You Can Do |
|--------|---------------|-----------------|
| **Draft** | Saved but not submitted | Edit, Submit, or Delete |
| **Pending HOD** | Awaiting HOD approval | View only, wait for HOD |
| **HOD Approved** | HOD approved, sent to Finance | View only, wait for Finance |
| **Finance Approved** | Finance approved, sent to MD | View only, wait for MD |
| **MD Approved** | MD approved, sent to Procurement | View only, track progress |
| **In Procurement** | Being processed by Procurement | View, check for quotes |
| **PO Issued** | Purchase Order created | View PO details |
| **Completed** | Items delivered | View final documentation |
| **HOD Rejected** | HOD rejected your request | View reason, edit, resubmit |
| **Finance Rejected** | Finance rejected | View reason, contact Finance |
| **MD Rejected** | MD rejected | View reason, contact MD |
| **Cancelled** | You or admin cancelled | View only, cannot reactivate |

### Viewing Requisition Details

1. Find your requisition in the list
2. Click the **"View"** button (eye icon)
3. You'll see:
   - All requisition details
   - All items with prices
   - Approval history
   - Comments from approvers
   - Attached documents
   - Current status

### Editing a Draft Requisition

1. Find requisition with "Draft" status
2. Click **"Edit"** button (pencil icon)
3. Make your changes
4. Click "Save as Draft" or "Submit for Approval"

**Note:** You can only edit requisitions in "Draft" status!

### Deleting a Requisition

1. Find requisition you want to delete
2. Click **"Delete"** button (trash icon)
3. Confirm deletion
4. Requisition is permanently removed

**Note:** You can only delete drafts or rejected requisitions!

### Resubmitting a Rejected Requisition

If your requisition was rejected:

1. Click **"View"** to see rejection reason
2. Read the comments carefully
3. Click **"Edit"** button
4. Make required changes based on feedback
5. Update justifications if needed
6. Click **"Submit for Approval"** again

---

## 🔍 Tracking Requisition Progress

### Approval Workflow

Your requisition follows this path:

```
Initiator (You)
    ↓
HOD (Head of Department)
    ↓
Finance Department
    ↓
MD (Managing Director)
    ↓
Procurement Department
    ↓
Purchase Order Issued
    ↓
Delivery & Completion
```

### Viewing Approval History

1. Open requisition details
2. Scroll to "Approval History" section
3. You'll see:
   - Who reviewed it
   - When they reviewed it
   - Their decision (Approved/Rejected)
   - Their comments
   - Time stamps

### Reading Approver Comments

**HOD Comments:**
- May ask for more justification
- May suggest alternatives
- May approve with conditions

**Finance Comments:**
- Budget availability notes
- Cost concerns
- Alternative funding sources

**MD Comments:**
- Strategic alignment
- Budget priorities
- Final authorization notes

**Procurement Comments:**
- Vendor selection updates
- Quote comparisons
- Delivery timelines
- PO details

---

## 🛒 After Approval - Procurement Phase

### What Happens Next

Once MD approves:

1. **Sent to Procurement**
   - Procurement team receives notification
   - Status: "In Procurement"

2. **Vendor Quotes**
   - Procurement requests 3 quotes
   - Quotes uploaded to system
   - You can view quotes

3. **Adjudication**
   - Procurement selects best vendor
   - Selection justified in system

4. **Purchase Order**
   - PO created automatically
   - PO number assigned (e.g., PO-2025-001)
   - Status: "PO Issued"

5. **Delivery**
   - Items ordered from vendor
   - Delivery tracking updated
   - You'll be notified

6. **Completion**
   - Items received and verified
   - Status: "Completed"
   - Final documentation available

### Viewing Purchase Orders

1. Go to "My Requisitions"
2. Find requisition with "PO Issued" status
3. Click **"View PO"** button
4. You'll see:
   - PO number
   - Vendor details
   - Item details
   - Delivery information
   - Total amount

### Viewing Vendor Quotes

If procurement uploaded quotes:

1. Open requisition details
2. Scroll to "Vendor Quotes" section
3. View all 3 quotes
4. See comparison table
5. See selected vendor with justification

---

## 📄 Reports and Exports

### Downloading Requisition PDF

1. Open requisition details
2. Click **"Download PDF"** button
3. PDF saved to your Downloads folder
4. PDF includes:
   - All requisition details
   - Items with prices
   - Approval history
   - Company logo and branding

### Printing Requisition

1. Open requisition details
2. Click **"Print"** button
3. Adjust print settings
4. Click "Print"

### Exporting Your Requisitions

1. Go to "My Requisitions"
2. Click **"Export"** button
3. Choose format:
   - Excel (.xlsx)
   - CSV
   - PDF report
4. File downloaded automatically

---

## 👤 Managing Your Profile

### Viewing Your Profile

1. Click your name in top-right corner
2. Select **"Profile"**
3. You'll see:
   - Username
   - Full name
   - Email address
   - Department
   - Role
   - Last login date

### Updating Your Information

1. Go to Profile page
2. Click **"Edit Profile"**
3. Update:
   - Email address
   - Phone number
   - Department (if changed)
4. Click **"Save Changes"**

### Changing Your Password

1. Go to Profile page
2. Click **"Change Password"**
3. Enter:
   - Current password
   - New password (min 8 characters)
   - Confirm new password
4. Click **"Update Password"**

**Password Requirements:**
- Minimum 8 characters
- At least one letter
- At least one number
- Cannot be same as username

---

## 💡 Tips for Success

### Creating Effective Requisitions

**DO:**
- ✅ Provide clear, detailed descriptions
- ✅ Include accurate quantities and prices
- ✅ Attach supporting documents
- ✅ Give strong justifications
- ✅ Submit early (consider approval time)
- ✅ Check budget availability first
- ✅ Use correct priority levels

**DON'T:**
- ❌ Rush submissions without checking
- ❌ Inflate quantities or prices
- ❌ Submit without justification
- ❌ Mark everything as "Urgent"
- ❌ Forget to attach quotes
- ❌ Use vague descriptions
- ❌ Submit last minute

### Writing Good Justifications

**Poor Justification:**
```
"We need this item."
```

**Good Justification:**
```
"We need 2 new laptops for the Finance department because:
1. Current laptops are 5 years old and failing frequently
2. New accounting software requires higher specifications
3. Downtime costs approximately K500 per day in lost productivity
4. These will support 2 new staff members hired in Q1"
```

### Getting Faster Approvals

1. **Complete Information**
   - Fill all required fields
   - Provide detailed descriptions

2. **Strong Justification**
   - Explain business need
   - Show cost-benefit analysis

3. **Supporting Documents**
   - Attach vendor quotes
   - Include specifications

4. **Correct Priority**
   - Don't abuse "Urgent" status
   - Plan ahead when possible

5. **Budget Alignment**
   - Check budget availability
   - Use correct budget codes

6. **Follow Up**
   - Check status regularly
   - Respond to comments quickly

---

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Issue 1: Cannot Login

**Problem:** Login fails with error message

**Solutions:**
1. Check username spelling (case-sensitive)
2. Verify password (no extra spaces)
3. Clear browser cache and cookies
4. Try different browser
5. Contact IT support if still failing

#### Issue 2: Cannot Submit Requisition

**Problem:** Submit button disabled or grayed out

**Solutions:**
1. Check all required fields filled (marked with *)
2. Ensure at least one item added
3. Verify unit prices entered
4. Check total amount calculated
5. Try saving as draft first

#### Issue 3: File Upload Failed

**Problem:** Cannot attach documents

**Solutions:**
1. Check file size (max 10 MB)
2. Verify file format (PDF, JPG, PNG, DOC, XLS)
3. Try renaming file (remove special characters)
4. Compress large files
5. Try different file

#### Issue 4: Cannot See My Requisitions

**Problem:** Requisition list is empty

**Solutions:**
1. Check filter settings (show all)
2. Refresh page (F5)
3. Clear browser cache
4. Try different browser
5. Verify you created requisitions

#### Issue 5: Total Amount Wrong

**Problem:** Calculated total doesn't match

**Solutions:**
1. Check unit prices entered correctly
2. Verify quantities
3. Check decimal points
4. Refresh page
5. Re-enter item if persists

#### Issue 6: Status Not Updating

**Problem:** Requisition status stuck

**Solutions:**
1. Refresh page
2. Log out and log back in
3. Check with approver directly
4. Contact system administrator

---

## 📞 Getting Help

### Contact Information

**IT Support:**
- Email: support@company.com
- Phone: +260-XXX-XXXX
- Hours: Monday-Friday, 8:00 AM - 5:00 PM

**System Administrator:**
- Name: Admin User
- Username: admin
- For: Account issues, technical problems

**Your HOD:**
- For: Requisition approvals, policy questions
- Check in organizational chart

**Finance Department:**
- For: Budget questions, funding issues
- Phone: Extension XXXX

**Procurement Department:**
- For: Vendor questions, delivery status
- Phone: Extension XXXX

### Quick Support Options

1. **In-App Help**
   - Click "?" icon in top menu
   - Access tutorials and guides

2. **Email Support**
   - Send details to support email
   - Include screenshots if possible
   - Provide requisition number

3. **Phone Support**
   - Call during business hours
   - Have requisition number ready

---

## 📚 Appendices

### Appendix A: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + N | New requisition |
| Ctrl + S | Save draft |
| Ctrl + P | Print |
| Ctrl + F | Search requisitions |
| Esc | Close modal/dialog |

### Appendix B: Status Icons

| Icon | Meaning |
|------|---------|
| 🟡 | Pending/In Progress |
| 🟢 | Approved/Completed |
| 🔴 | Rejected/Failed |
| ⚪ | Draft/Not Started |
| 🔵 | In Review |

### Appendix C: Common Budget Codes

| Code | Department | Description |
|------|------------|-------------|
| FIN-OPEX | Finance | Operational expenses |
| HR-REC | HR | Recruitment costs |
| IT-INF | IT | Infrastructure |
| FAC-MAIN | Facilities | Maintenance |
| MKT-ADV | Marketing | Advertising |

*Check with your department for specific codes*

### Appendix D: Priority Levels

| Level | Use When | Expected Time |
|-------|----------|---------------|
| **Normal** | Regular purchases | 5-10 business days |
| **Urgent** | Needed within 2 weeks | 3-5 business days |
| **Critical** | Emergency/breakdown | 1-2 business days |

### Appendix E: File Format Guide

**Accepted Formats:**

| Type | Extensions | Max Size |
|------|------------|----------|
| Documents | .pdf, .doc, .docx | 10 MB |
| Spreadsheets | .xls, .xlsx, .csv | 10 MB |
| Images | .jpg, .jpeg, .png | 10 MB |
| Compressed | .zip, .rar | 20 MB |

---

## 📝 Quick Reference Card

**Print this page for your desk!**

### Login
**URL:** http://localhost:3000
**Username:** [your username]

### Create Requisition
1. Click "+ Create Requisition"
2. Fill all details
3. Add items
4. Attach documents
5. Submit

### Check Status
1. Click "My Requisitions"
2. Find requisition
3. Check status column

### Need Help?
**Email:** support@company.com
**Phone:** +260-XXX-XXXX

### Approval Flow
You → HOD → Finance → MD → Procurement → PO → Delivery

---

**End of Initiator User Manual**

*For other role manuals, see:*
- USER_MANUAL_HOD.pdf
- USER_MANUAL_FINANCE.pdf
- USER_MANUAL_MD.pdf
- USER_MANUAL_PROCUREMENT.pdf
- USER_MANUAL_ADMIN.pdf

**Version:** 3.0
**Last Updated:** January 6, 2025
**© 2025 Your Company Name. All rights reserved.**
