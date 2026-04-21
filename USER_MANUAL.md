# KSB Purchase Requisition System — User Manual

A step-by-step guide organised by role. Find your role below and read just that section plus the **All Users** section at the top.

---

## Table of Contents

- [All Users — Login, Navigation, Basics](#all-users--login-navigation-basics)
- [Role 1: Initiator (any staff member)](#role-1-initiator-any-staff-member)
- [Role 2: HOD (Head of Department)](#role-2-hod-head-of-department)
- [Role 3: Finance / Finance Manager](#role-3-finance--finance-manager)
- [Role 4: MD (Managing Director)](#role-4-md-managing-director)
- [Role 5: Procurement](#role-5-procurement)
- [Role 6: Stores User](#role-6-stores-user-has-can_access_stores-flag)
- [Role 7: Admin](#role-7-admin)
- [Troubleshooting — All Users](#troubleshooting--all-users)
- [Appendix A — Status Values](#appendix-a--status-values)
- [Appendix B — Document ID Formats](#appendix-b--document-id-formats)

---

## All Users — Login, Navigation, Basics

Read this section first, regardless of your role.

### Logging In

1. Open a web browser (Chrome, Edge, or Firefox).
2. Go to the system URL given by your Administrator.
3. Type your **Username** and **Password**.
4. Click **Login**.
5. You land on the **Dashboard**.

### The Screen Layout

- **Top bar** — your name, role, and log-out button
- **Left sidebar** — the menu; items shown match your role
- **Main area** — where forms and lists appear

### Sidebar Sections (only ones your role allows appear)

| Section | Contains |
|---|---|
| Procurement | Requisitions, approvals, purchase orders |
| Financial Forms | EFT, Petty Cash, Expense Claims |
| Stores | GRNs, Issue Slips, Picking Slips, Stock Register |
| Financial Planning | Budgets, FX Rates |
| Reports & Analytics | Summary reports and charts |
| Administration | User, vendor, and client management |

### Logging Out

- Click your name in the top-right → **Logout**.
- Always log out before leaving a shared computer. After 15 minutes of inactivity the system logs you out automatically.

### Security Rules You Should Know

- Passwords must be at least 8 characters with an uppercase, a lowercase, and a digit.
- After 20 failed login attempts from one computer in 15 minutes, the system blocks further attempts for 15 minutes.
- Every approval or rejection you make is logged with your name, IP address, and timestamp.

---

## Role 1: Initiator (any staff member)

### Who you are

Any staff member who needs the company to spend money on their behalf — whether by buying something, paying a supplier, drawing petty cash, or reimbursing you for something you already paid for.

### What you will do most often

1. Create a form (Purchase Requisition, EFT, Petty Cash, or Expense Claim).
2. Track its progress through approvals.
3. Respond to rejections by correcting and resubmitting.

### 1.1 Create a Purchase Requisition

Use this when you want the company to buy goods or services.

1. Sidebar → **Procurement → Create Requisition**.
2. Fill in the header:
   - **Title** — short name (e.g. "Office printer toner")
   - **Description** — what you need and why
   - **Delivery Location** — where goods should be delivered
   - **Required Date** — when you need them
3. Click **Add Item** for each line and enter:
   - Item name (required)
   - Item code (if known)
   - Quantity (must be 1 or more)
   - Unit (pcs, kg, box, etc.)
   - Estimated unit price (if known)
4. Attach a supplier quote if you have one.
5. Fill the **Justification** box — more important for high-value requests.
6. Click **Submit**.
7. The system creates a requisition with an ID like `KSB-PR-20260421…` and status **Pending HOD**. Your HOD gets an email.

### 1.2 Create an EFT Requisition

Use this when the company needs to pay someone by electronic transfer.

1. Sidebar → **Financial Forms → EFT Requisitions → Create New EFT**.
2. Fill in: payee name, bank details, amount, currency, purpose, invoice reference.
3. Click **Submit**. Status becomes **Pending HOD**.

### 1.3 Create a Petty Cash Requisition

Use this to draw petty cash for small immediate purchases.

1. Sidebar → **Financial Forms → Petty Cash → Create New Petty Cash Request**.
2. Fill in: amount, purpose, itemised breakdown of what you will buy.
3. Click **Submit**. Status becomes **Pending HOD**.

### 1.4 Create an Expense Claim

Use this to be reimbursed for money you spent on behalf of the company.

1. Sidebar → **Financial Forms → Expense Claims → Create New Claim**.
2. Fill in: date, category, amount, description.
3. Attach your receipt (keep the paper version too).
4. Add more lines for each expense.
5. Click **Submit**. Status becomes **Pending HOD**.

### 1.5 Track Your Requests

1. Sidebar → pick the list for that form type (e.g. **My Requisitions** for PRs).
2. The **Status** column shows where the request is:
   - **Pending HOD** — at your Head of Department
   - **Pending Finance** — at Finance
   - **Pending MD** — at the Managing Director
   - **Approved** — fully approved
   - **Rejected** — someone rejected it; read the comment
3. Click a row to see full detail and the approval history.

### 1.6 What To Do If Rejected

1. Open the rejected request.
2. Read the rejection comment at the bottom.
3. You cannot edit a submitted request. Create a new one with the correction and reference the original in your description.

---

## Role 2: HOD (Head of Department)

### Who you are

Head of a department. You are the first approver for requests from anyone in your department and from your direct subordinates.

### What you will do most often

1. Review requests sitting at **Pending HOD**.
2. Approve or reject with comments.
3. Periodically check department spend.

### 2.1 Find Requests Waiting for You

1. Sidebar → **Procurement → Pending Approvals** (for Purchase Requisitions).
2. Sidebar → **Financial Forms → Pending Approvals** (for EFT, Petty Cash, Expense Claims).
3. Sidebar → **Stores → Issue Slips** (filter by **Pending HOD** if you approve stores issues).
4. Each list shows only items waiting for you.

### 2.2 Review a Request

1. Click a row to open the full detail view.
2. Check:
   - **Header** — who created it, when, why
   - **Items and amounts** — are quantities and prices sensible?
   - **Justification** — is the need clear?
   - **Attachments** — quotes, invoices, receipts
   - **Approval history** — who else has touched it

### 2.3 Approve or Reject

1. At the bottom of the detail page, type a **comment**.
2. Click **Approve** to pass it to Finance (or the next stage).
3. Click **Reject** to send it back to the initiator.
4. Comments are stored permanently. Always give a clear reason for a rejection.

### 2.4 What Happens After You Approve

- Purchase Requisition: status becomes **Pending Finance**; Finance team gets email.
- EFT / Petty Cash / Expense Claim: status becomes **Pending Finance**.
- Issue Slip: status becomes **Pending Finance**.

### 2.5 Your Department Dashboard

- Sidebar → **Dashboard** shows your department's open requests and recent activity.
- Sidebar → **Reports & Analytics → Reports** shows department-level spend.

---

## Role 3: Finance / Finance Manager

### Who you are

Finance officer or finance manager. You are the second approver in every workflow after the HOD. You also see budgets and FX rates.

### What you will do most often

1. Review requests at **Pending Finance**.
2. Approve GRNs.
3. Maintain budgets and FX rates.

### 3.1 Review Pending Finance Requests

1. Sidebar → **Procurement → Pending Approvals** or **Financial Forms → Pending Approvals**.
2. Each item shown is at **Pending Finance** — you are the next approver.
3. Click a row, review, add a comment, then click **Approve** or **Reject**.

### 3.2 Approve a Goods Receipt Note (GRN)

1. Sidebar → **Stores → Goods Receipt Notes**.
2. Pick a GRN with status **Pending Approval**.
3. Verify the received quantities match the delivery documents.
4. Type a comment.
5. Click **Approve** or **Reject**.
6. Once approved, the goods are formally in stock and can be issued.

**Important**: If another approver is acting on the same GRN at the same moment, the system allows only one to succeed. The later one sees a `409 Conflict` message and must refresh.

### 3.3 Approve an Issue Slip (Finance Stage)

1. Sidebar → **Stores → Issue Slips**.
2. Pick one at **Pending Finance**.
3. Confirm the quantities fit within the GRN stock available.
4. Click **Approve** (the system has already done the math; it will block over-issues).

### 3.4 Maintain Budgets

1. Sidebar → **Financial Planning → Budgets**.
2. Each department shows its annual budget and current spend.
3. Click a row to edit the budget value.
4. Save changes. New requisitions that push a department over budget will be flagged.

### 3.5 Maintain FX Rates

1. Sidebar → **Financial Planning → FX Rates**.
2. Enter the current rate to ZMW for each currency (USD, EUR, GBP, ZAR).
3. Save. Requisitions with foreign-currency quotes will convert to ZMW for comparison.

### 3.6 What Happens After You Approve

- Purchase Requisition: goes to **Pending MD** if value exceeds the MD threshold, otherwise becomes **Approved**.
- EFT / Petty Cash / Expense Claim: becomes **Approved**.
- Issue Slip: becomes **Approved**, stock is deducted.
- GRN: becomes **Approved**, stock is added.

---

## Role 4: MD (Managing Director)

### Who you are

Managing Director. You are the final approver for high-value Purchase Requisitions.

### What you will do most often

1. Review requests at **Pending MD**.
2. Approve or reject.

### 4.1 Find Requests Waiting for You

1. Sidebar → **Procurement → Pending Approvals**.
2. The list shows only requisitions at **Pending MD**.

### 4.2 Review and Decide

1. Click a row.
2. Read the full history: who initiated, who approved below you, comments from HOD and Finance.
3. Check total cost, vendor, and justification.
4. Type a comment.
5. Click **Approve** (becomes **Approved** final) or **Reject** (returns to initiator).

### 4.3 What You Don't Need to Do

- You don't need to create or track requisitions yourself unless you initiate one.
- EFT, Petty Cash, and Expense Claim forms are normally handled by Finance without reaching you.

---

## Role 5: Procurement

### Who you are

Procurement team member. You see every requisition and manage the vendor side of the process.

### What you will do most often

1. See approved requisitions ready for purchase orders.
2. Collect and load quotes.
3. Run adjudication to pick a winning vendor.

### 5.1 See All Requisitions

1. Sidebar → **Procurement → My Requisitions** or **Approved Requisitions**.
2. You see everyone's requisitions, filtered by tabs.

### 5.2 Add Quotes to a Requisition

1. Open an approved requisition.
2. Scroll to the **Quotes** section.
3. Click **Add Quote**.
4. Fill in:
   - Vendor (choose from dropdown or add a new vendor via **Administration → Vendors**)
   - Unit prices per line item
   - Quote currency
   - Attachment (the quote PDF)
5. Add a second and third quote for comparison.

### 5.3 Run Adjudication

1. Sidebar → **Procurement → Adjudication**.
2. Pick a requisition with multiple quotes.
3. The system shows side-by-side comparison in ZMW (converted using current FX rates).
4. Mark the winning quote.
5. Add a short rationale.
6. Save. The requisition is now locked to that vendor and moves towards purchase order creation.

### 5.4 Manage Vendors

1. Sidebar → **Administration → Vendors** (if you have access).
2. Add new vendors with name, code, category, contact, and tier.
3. Bulk-upload vendors from an Excel file.

### 5.5 Track Rejected Requisitions

1. Sidebar → **Procurement → Rejected Requisitions**.
2. Review why requests failed so you can feed back to initiators or policy.

---

## Role 6: Stores User (has "can_access_stores" flag)

### Who you are

Warehouse or stores staff. You physically handle goods in and out of stores. Your user account has the **Can Access Stores** flag enabled.

### What you will do most often

1. Create Goods Receipt Notes (GRNs) when suppliers deliver.
2. Create Issue Slips when goods leave stores.
3. Create Picking Slips when moving stock between locations.
4. Check the Stock Register.

### 6.1 Create a GRN (goods have arrived)

1. Sidebar → **Stores → Create GRN**. The form opens in a new page.
2. Fill in the header:
   - **Reference PR** — pick the approved purchase requisition from the dropdown
   - **Supplier / Vendor** — who delivered
   - **Delivery Date**
   - **Customer** — only fill if the stock is reserved for a specific customer
3. For each line received:
   - Item name/description
   - **Quantity Received** (must match what actually arrived)
   - Unit
4. Click **Submit**.
5. The GRN is created with status **Pending Approval** (Finance or the assigned approver will approve it next).

### 6.2 Create an Issue Slip (goods are leaving stores)

1. Sidebar → **Stores → Create Issue Slip**.
2. Fill in:
   - **Issued To** — person receiving
   - **Department**
   - **Delivery Location**
   - **Delivery Date**
   - **Reference Number** — GRN the stock came in on (required if drawing from a specific receipt)
   - **Customer** — must match the GRN customer if the GRN is customer-reserved
3. Add items with quantities. The system checks available stock automatically:
   - If you request more than remaining, you see an error like `Insufficient stock for "Widget": requested 10, available 7`.
   - Fix the quantity or issue from a different GRN.
4. Click **Submit**. Status becomes **Pending HOD** (HOD then Finance approve before stock actually deducts).

### 6.3 Create a Picking Slip (moving stock between locations)

1. Sidebar → **Stores → Create Picking Slip**.
2. Fill in:
   - Picker name
   - Source and destination locations
   - Items and quantities
3. Click **Submit**. Status goes directly to **Completed** (no approval needed).

### 6.4 Check Stock Levels

1. Sidebar → **Stores → Real-Time Stock Register**.
2. You see per item:
   - **Stock In** — approved GRNs
   - **Stock Out** — approved Issue Slips
   - **Reserved** — pending issue slips
   - **Available** — Stock In minus Stock Out minus Reserved
3. Search by item description to find a specific part.

### 6.5 Manage Stock Items

1. Sidebar → **Stores → Stock Items**.
2. Browse the catalogue.
3. Add new item codes and descriptions (if your role allows).

### 6.6 Print a PDF

- Any GRN, Issue Slip, or Picking Slip can be printed to PDF from the detail page using the **Download PDF** button.

---

## Role 7: Admin

### Who you are

System administrator. You manage users, vendors, clients, budgets, and all reference data.

### What you will do most often

1. Create and manage user accounts.
2. Update the vendor list.
3. Set department budgets and FX rates.
4. Respond to password resets and role changes.

### 7.1 Create a User

1. Sidebar → **Administration → Users**.
2. Click **Add User**.
3. Fill in:
   - Username (3+ characters, letters/numbers/dots/underscores/hyphens)
   - Password (8+ characters with upper, lower, digit)
   - Full name, email, role, department
   - Tick **HOD** if this person is a department head
   - Tick **Can Access Stores** if they should see the Stores module
4. Click **Save**. The user gets an email (if email is configured) and can log in immediately.

### 7.2 Reset a Password

1. Sidebar → **Administration → Users**.
2. Click the user.
3. Use the **Reset Password** action.
4. Tell the user their temporary password out-of-band.

### 7.3 Change a User's Role

1. Open the user.
2. Change the role in the dropdown.
3. Save. The change takes effect on their next login.

### 7.4 Disable (Don't Delete) a Former Employee

1. Open the user.
2. Set their status to **Inactive** (or tick **Disabled**).
3. This preserves their historical approvals in the audit log. Never delete a user who has approved or initiated anything.

### 7.5 Manage Vendors

1. Sidebar → **Administration → Vendors**.
2. Add, edit, or disable vendors.
3. Use the Excel upload to load a vendor list in bulk.

### 7.6 Manage Clients

1. Sidebar → **Administration → Clients**.
2. Add clients that stock is reserved for.

### 7.7 Set Budgets

1. Sidebar → **Financial Planning → Budgets**.
2. Edit the annual budget for each department.

### 7.8 Set FX Rates

1. Sidebar → **Financial Planning → FX Rates**.
2. Update ZMW rates for USD, EUR, GBP, ZAR.

### 7.9 Review the Audit Log

- Every approval, rejection, and GRN status change is recorded:
  actor, IP, browser, from/to status, timestamp, comment.
- Admins can request a specific audit slice from IT.

### 7.10 Emergency: Reassign a Stuck Approval

- If an approver is unavailable for a long time, Admin can open the stuck form and change the assignment. Document the reason in the comments.

---

## Troubleshooting — All Users

### "Invalid username or password. Make sure backend server is running."

- **Backend is down** → contact IT.
- **Wrong credentials** → ask Admin to reset your password.

### "Too many login attempts from this IP"

- Wait 15 minutes and try again. If it keeps happening, contact IT — someone may be guessing passwords from your network.

### "Insufficient stock for …"

- The GRN has less stock remaining than you requested.
- Check the **Stock Register** for real availability, including stock reserved by pending issue slips.

### I got logged out suddenly

- Normal — sessions expire after 15 minutes of inactivity for security.
- Log back in.

### I can't see a menu item I expect

- The sidebar hides items based on your role.
- Confirm your role in the top-right corner.
- If wrong, ask Admin to update it.

### A file didn't upload

- Maximum size is 10 MB.
- Use PDF, JPG, PNG, Excel, or Word.

### I need to correct a mistake on a submitted form

- Ask the next approver to reject it with a comment.
- Create a new form with the correction — you cannot edit a submitted form.

### Who do I contact?

| Problem | Contact |
|---|---|
| Login / password | Your Admin |
| Wrong role or department | Your Admin |
| Backend errors / system down | IT |
| Budget or policy questions | Finance or your HOD |

---

## Appendix A — Status Values

| Status | Appears on | Meaning |
|---|---|---|
| `draft` | Any form | Saved but not submitted |
| `pending_hod` | PR, EFT, Petty Cash, Expense Claim, Issue Slip | Waiting for HOD |
| `pending_finance` | Same list | HOD approved, waiting for Finance |
| `pending_md` | Purchase Requisitions | Finance approved, waiting for MD |
| `pending_approval` | GRN | Waiting for assigned approver |
| `approved` | All | Fully approved |
| `rejected` | All | Rejected — see comment |
| `completed` | Picking Slip | Recorded (no approval needed) |

---

## Appendix B — Document ID Formats

| Code | Meaning |
|---|---|
| `KSB-PR-…` | Purchase Requisition |
| `KSB-EFT-…` | EFT Requisition |
| `KSB-PC-…` | Petty Cash |
| `KSB-EXP-…` | Expense Claim |
| `KSB-GRN-…` | Goods Receipt Note |
| `KSB-ISS-…` | Issue Slip |
| `KSB-PCK-…` | Picking Slip |

Use these IDs when emailing or calling about a specific record.

---

*End of manual.*
