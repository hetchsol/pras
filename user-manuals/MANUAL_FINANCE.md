# User Manual - Finance Department

**Purchase Requisition System v3.0**

---

## Your Role

As **Finance Officer**, you review budget and financial aspects.

### Responsibilities
- Review budget availability
- Verify financial compliance
- Approve or reject based on budget
- Track organizational spending
- Manage FX rates and budgets
- Generate financial reports

---

## Getting Started

### Login
1. URL: **http://localhost:3000**
2. Username: `sarah.banda` (or your username)
3. Password: `password123`

---

## Dashboard

### Key Metrics
- Pending financial reviews
- Total approved amount (month)
- Budget utilization
- Department spending breakdown
- FX rate status

---

## Reviewing Requisitions

### Step 1: Access Finance Queue
- Click "Finance Approvals"
- View requisitions approved by HOD

### Step 2: Review Financial Details
Check:
- **Budget Code**: Correct and active
- **Budget Availability**: Sufficient funds
- **Pricing**: Reasonable and competitive
- **Currency**: Correct (ZMW/USD)
- **FX Rates**: Current rates applied
- **Total Amount**: Calculated correctly

### Step 3: Budget Verification
1. Check budget code validity
2. Verify available balance
3. Consider committed amounts
4. Check spending trends
5. Confirm authority limits

### Step 4: Make Decision

#### Approve
- Budget available
- Prices reasonable
- Financially compliant
- Proper documentation

**Add Comment:**
```
Approved. Budget code FIN-2025-001 has sufficient
funds (K75,000 available). Amount is within
departmental authority limits.
```

#### Reject
- Insufficient budget
- Excessive pricing
- Wrong budget code
- Non-compliant

**Add Comment:**
```
Rejected - Insufficient budget.
Budget code FIN-2025-001 has only K25,000 remaining
(K50,000 requested). Please use alternative budget
code or defer to next quarter.
```

#### Request Info
- Need budget clarification
- Require cost breakdown
- Need alternative quotes

---

## Budget Management

### Managing Department Budgets

1. Click "Budget Management"
2. View all department budgets
3. Update allocations
4. Track utilization
5. Set alerts

### Adding/Updating Budgets

**Add New Budget:**
1. Click "Add Budget"
2. Enter:
   - Budget code
   - Department
   - Amount (ZMW)
   - Fiscal period
   - Description
3. Click "Save"

**Update Budget:**
1. Find budget in list
2. Click "Edit"
3. Update amount or details
4. Click "Update"

### Budget Monitoring

**Check Budget Status:**
- Total allocated
- Amount spent
- Amount committed (pending)
- Available balance
- Utilization percentage

**Set Budget Alerts:**
- 75% utilization warning
- 90% utilization critical
- Over-budget notification

---

## FX Rate Management

### Viewing FX Rates

1. Click "FX Rates"
2. View current rates:
   - USD to ZMW
   - Date last updated
   - Historical rates

### Updating FX Rates

1. Go to "FX Rates" → "Update Rate"
2. Enter new rate
3. Effective date
4. Source (e.g., Bank of Zambia)
5. Click "Update"

**Note:** System uses latest rate for USD conversions

### Multi-Currency Requisitions

**When items in USD:**
- System auto-converts to ZMW
- Uses current FX rate
- Shows both amounts
- Budget checked in ZMW

---

## Financial Reports

### Available Reports

1. **Budget Utilization Report**
   - By department
   - By budget code
   - Variance analysis

2. **Spending Analysis**
   - Monthly trends
   - Category breakdown
   - Top spenders

3. **Commitment Report**
   - Pending requisitions
   - Future obligations
   - Cash flow forecast

4. **Approval Statistics**
   - Finance approval rate
   - Average approval time
   - Rejection reasons

### Generating Reports

1. Click "Reports" → "Financial Reports"
2. Select report type
3. Choose date range
4. Select filters (department, budget code)
5. Click "Generate"
6. Export to Excel or PDF

---

## Financial Compliance

### Check These Items

**Budget Compliance:**
- ✅ Valid budget code
- ✅ Sufficient funds
- ✅ Correct fiscal period
- ✅ Within authority limits

**Pricing Compliance:**
- ✅ Market rates reasonable
- ✅ Quotes compared (if high value)
- ✅ No obvious overpricing
- ✅ Currency correct

**Documentation:**
- ✅ Supporting quotes attached
- ✅ Cost breakdown provided
- ✅ Budget approval (if required)
- ✅ Special approvals (if applicable)

---

## Authority Limits

### Approval Thresholds

| Amount | Authority Required |
|--------|-------------------|
| Up to K50,000 | Finance approval |
| K50,001 - K100,000 | Finance + MD |
| Over K100,000 | Finance + MD + Board |

**Your Role:**
- Approve up to K50,000 independently
- Recommend to MD for higher amounts
- Flag to MD for special cases

---

## Common Scenarios

### Scenario 1: No Budget Code
```
Reject: "Budget code missing or invalid.
Please provide valid budget code and resubmit.
Contact Finance for budget code list."
```

### Scenario 2: Budget Exceeded
```
Reject: "Budget exceeded. Code FIN-001 has K25,000
available but K50,000 requested. Options:
1) Use alternative budget code
2) Split across multiple codes
3) Defer to Q2"
```

### Scenario 3: High Price
```
Request Info: "Price appears high. Please provide:
1) Three vendor quotes for comparison
2) Justification for selected vendor
3) Market rate research"
```

### Scenario 4: Wrong Currency
```
Request Info: "Please clarify currency. Items listed
in USD but local ZMW pricing may be more favorable.
Confirm vendor requirements."
```

---

## Budget Year-End

### End of Quarter Actions

1. Review all pending requisitions
2. Check budget commitments
3. Identify unused allocations
4. Prepare rollover requests
5. Generate quarter-end reports

### Budget Closure

1. Finalize all pending approvals
2. Reject unfunded requests
3. Document carry-forwards
4. Archive financial records
5. Prepare next period budgets

---

## Tips for Finance Review

### Speed Up Approvals

1. **Check Budget First** - Saves time
2. **Standard Templates** - Use for comments
3. **Batch Processing** - Group similar requests
4. **Set Priorities** - Critical items first
5. **Auto-Alerts** - Monitor high-value items

### Red Flags

Watch for:
- Unusual pricing
- Duplicate requests
- Budget code shopping
- Last-minute rush requests
- Missing documentation
- Round numbers (estimates?)

---

## Working with Other Departments

### With HOD
- Coordinate on budget planning
- Discuss spending patterns
- Resolve budget issues
- Plan major purchases

### With MD
- Escalate high-value items
- Discuss budget reallocations
- Present financial analysis
- Recommend policy changes

### With Procurement
- Coordinate on vendor payments
- Discuss pricing trends
- Share market intelligence
- Optimize purchasing

---

## Analytics Dashboard

### Financial KPIs

Monitor:
- **Budget Utilization Rate** - Target: 85-95%
- **Approval Turnaround** - Target: < 2 days
- **Budget Variance** - Target: < 10%
- **Spend by Category** - Track trends

### Monthly Review

Conduct monthly:
1. Budget vs actual analysis
2. Departmental spending review
3. FX impact assessment
4. Forecast update
5. Board report preparation

---

## Contact Information

**For Budget Questions:**
- CFO: Extension XXXX
- Budget Controller: Extension XXXX

**For System Issues:**
- IT Support: support@company.com
- Admin: admin user

**For Policy:**
- Finance Policy Manual
- Procurement Guidelines

---

## Quick Reference

### Approval Flow
```
Initiator → HOD → YOU (Finance) → MD → Procurement
```

### Decision Criteria
- ✅ Budget available
- ✅ Prices reasonable
- ✅ Financially compliant
- ✅ Properly documented

### Key Shortcuts
- Ctrl + B: Check budget
- Ctrl + A: Approve
- Ctrl + R: Reject
- Ctrl + F: Filter by budget code

---

**End of Finance Manual**
