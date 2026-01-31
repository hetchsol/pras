# User Manual - Procurement Department

**Purchase Requisition System v3.0**

---

## Your Role

As **Procurement Officer**, you execute approved requisitions.

### Responsibilities
- Process MD-approved requisitions
- Request vendor quotes (3 quotes minimum)
- Conduct adjudication
- Create Purchase Orders
- Track deliveries
- Manage vendor relationships

---

## Getting Started

### Login
1. URL: **http://localhost:3000**
2. Username: `james.phiri` (or your username)
3. Password: `password123`

---

## Dashboard

### Key Metrics
- Requisitions in procurement
- POs issued this month
- Pending deliveries
- Vendor performance
- Quote comparisons needed

---

## Processing Requisitions

### Step 1: Receive MD-Approved Requisition

Requisitions reach you after:
- ✅ HOD approved
- ✅ Finance approved
- ✅ MD authorized

### Step 2: Review Requirements

Check:
- Item specifications
- Quantities needed
- Delivery timeline
- Special requirements
- Budget allocated

### Step 3: Request Vendor Quotes

**Minimum 3 Quotes Required:**

1. Click "Request Quotes"
2. Select vendors or add new
3. Send RFQ (Request for Quotation)
4. Set deadline (typically 5-7 days)
5. Track responses

**RFQ Should Include:**
- Item specifications
- Quantities
- Delivery location
- Delivery timeline
- Payment terms
- Quality requirements

### Step 4: Upload Quotes

When quotes received:

1. Click "Upload Quotes"
2. For each quote:
   - Vendor name
   - Quote date
   - Quoted price
   - Delivery terms
   - Validity period
   - Upload quote document (PDF)
3. Save all quotes

**Required Information:**
- Vendor company name
- Contact person
- Unit price
- Total price
- Delivery time
- Payment terms
- Warranty/guarantees

### Step 5: Comparative Analysis

System auto-generates comparison:

| Vendor | Price | Delivery | Quality | Total Score |
|--------|-------|----------|---------|-------------|
| Vendor A | K45,000 | 7 days | Good | 85 |
| Vendor B | K42,000 | 14 days | Excellent | 90 |
| Vendor C | K48,000 | 5 days | Good | 80 |

### Step 6: Adjudication

Select winning vendor:

1. Click "Adjudicate"
2. Select winning vendor
3. **Add justification (required)**
4. Submit decision

**Adjudication Criteria:**
- Price (40%)
- Quality (30%)
- Delivery time (20%)
- Vendor reputation (10%)

**Justification Example:**
```
Vendor B selected based on:
1. Competitive pricing (K42,000 vs K45,000 & K48,000)
2. Excellent quality rating
3. Proven track record (5 previous orders)
4. Acceptable delivery time (14 days)
5. 12-month warranty included

Price is K3,000 lower than Vendor A, and quality
is superior. Delivery time meets requirement.
```

### Step 7: Create Purchase Order

After adjudication:

1. Click "Create PO"
2. System auto-generates PO number
3. Review PO details:
   - Vendor information
   - Item details
   - Prices
   - Terms & conditions
4. Add special instructions
5. Click "Issue PO"

**PO Includes:**
- PO number (e.g., PO-2025-001)
- Date issued
- Requisition reference
- Vendor details
- Item descriptions
- Quantities and prices
- Delivery address
- Payment terms
- Company T&Cs

### Step 8: Send to Vendor

1. Download PO PDF
2. Email to vendor
3. Confirm receipt
4. Get delivery commitment
5. Update system with ETA

### Step 9: Track Delivery

1. Monitor delivery status
2. Update system:
   - Dispatched
   - In transit
   - Delivered
   - Received and inspected
3. Record actual delivery date
4. Note any issues

### Step 10: Close Requisition

When delivery complete:

1. Click "Mark as Delivered"
2. Attach delivery note
3. Confirm quantities received
4. Note condition of goods
5. Click "Complete"
6. Status changes to "Completed"

---

## Vendor Management

### Adding New Vendors

1. Click "Vendors" → "Add Vendor"
2. Enter details:
   - Company name
   - Contact person
   - Email and phone
   - Address
   - Tax ID/Registration
   - Bank details
   - Product/service categories
3. Upload documents:
   - Tax clearance
   - Registration certificate
   - Insurance
4. Click "Save"

### Vendor Database

Maintain information:
- Company profile
- Contact details
- Product categories
- Price history
- Performance ratings
- Compliance documents
- Payment history

### Vendor Performance

Track and rate:
- Delivery timeliness
- Quality of goods
- Pricing competitiveness
- Customer service
- Compliance
- Reliability

**Rating Scale: 1-5**
- 5: Excellent
- 4: Good
- 3: Satisfactory
- 2: Poor
- 1: Unacceptable

---

## Purchase Orders

### PO Numbering

Format: **PO-YYYY-NNN**
- PO: Prefix
- YYYY: Year
- NNN: Sequential number

Example: PO-2025-001, PO-2025-002

### PO Types

**Standard PO:**
- Regular purchases
- One-time delivery
- Fixed price

**Blanket PO:**
- Recurring items
- Multiple deliveries
- Fixed period

**Contract PO:**
- Long-term agreements
- Scheduled deliveries
- Volume discounts

### PO Status Tracking

| Status | Meaning |
|--------|---------|
| Draft | PO created, not issued |
| Issued | Sent to vendor |
| Acknowledged | Vendor confirmed |
| In Progress | Being prepared |
| Dispatched | Shipped |
| Delivered | Received |
| Completed | Closed |
| Cancelled | Cancelled |

---

## Quote Management

### Quote Comparison Rules

**Minimum Requirements:**
- At least 3 quotes
- Quotes from registered vendors
- Quotes within 30 days validity
- Complete specifications
- Total cost comparison

**Exceptions (MD approval needed):**
- Single source items
- Emergency purchases
- Proprietary products
- Below K5,000 value

### Evaluating Quotes

**Price Analysis:**
- Compare unit prices
- Check total costs
- Consider shipping
- Include taxes
- Factor warranties

**Non-Price Factors:**
- Quality certifications
- Delivery time
- Payment terms
- After-sales support
- Vendor reputation

**Example Evaluation:**
```
Quote Analysis: Office Furniture

Vendor A: K45,000
+ Lowest price
+ Fast delivery (7 days)
- No warranty
- Unknown quality

Vendor B: K52,000
+ 5-year warranty
+ Proven quality
+ Good reputation
- Highest price
- 14-day delivery

Vendor C: K48,000
+ 2-year warranty
+ Moderate price
+ 10-day delivery
- Average quality

Recommendation: Vendor B
Justification: Marginally higher price offset by
superior warranty and proven quality. Long-term
value better despite higher initial cost.
```

---

## Delivery Management

### Receiving Goods

**Delivery Checklist:**
1. Verify PO number
2. Count quantities
3. Check condition
4. Inspect quality
5. Match to specifications
6. Sign delivery note
7. Update system

**If Issues Found:**
- Partial delivery: Note shortfall
- Damaged goods: Photo evidence
- Wrong items: Document discrepancy
- Quality issues: Inspection report

### Handling Discrepancies

**Damaged Goods:**
1. Reject delivery or accept with note
2. Photo documentation
3. Contact vendor immediately
4. File claim if insured
5. Request replacement

**Short Delivery:**
1. Accept partial delivery
2. Note shortfall on delivery note
3. Update PO status to "Partial"
4. Follow up with vendor
5. Set new ETA for balance

---

## Reporting

### Procurement Reports

**Monthly Reports:**
- POs issued
- Total spend
- Vendor performance
- Delivery performance
- Quote analysis
- Cost savings

**Generate Reports:**
1. Click "Procurement Reports"
2. Select type
3. Set date range
4. Export to Excel/PDF

### Key Performance Indicators

Monitor:
- Average procurement cycle time
- On-time delivery rate
- Cost savings achieved
- Vendor performance scores
- Quote turnaround time
- PO accuracy rate

**Targets:**
- Cycle time: < 10 business days
- On-time delivery: > 90%
- Cost savings: 5-10% annually
- Vendor rating: > 4.0 average

---

## Emergency Procurement

### Fast-Track Process

For critical/emergency:

1. **Verify Emergency Status**
   - MD authorized
   - Business continuity risk
   - No alternatives

2. **Expedited Quotes**
   - Request same-day quotes
   - Accept phone/email quotes
   - Minimum 2 quotes (if time permits)

3. **Quick Adjudication**
   - Same-day selection
   - Document justification
   - Get MD confirmation

4. **Immediate PO**
   - Issue PO same day
   - Expedited delivery
   - Premium costs authorized

5. **Post-Event Review**
   - Document process
   - Lessons learned
   - Improve procedures

---

## Compliance

### Procurement Policies

**Must Follow:**
- 3-quote minimum (except exceptions)
- Registered vendors only
- Documented adjudication
- Proper PO issuance
- Delivery verification
- Payment authorization

**Prohibited:**
- Splitting orders to avoid approvals
- Favoritism
- Conflicts of interest
- Undisclosed commissions
- Backdating documents

### Audit Trail

System automatically records:
- Quote requests sent
- Quotes received
- Adjudication decisions
- PO creation and changes
- Delivery updates
- All user actions

---

## Tips for Efficient Procurement

### Speed Up Process

1. **Maintain Vendor Database** - Pre-approved vendors
2. **Standard Templates** - RFQ and PO templates
3. **Regular Communication** - Update stakeholders
4. **Batch Processing** - Group similar items
5. **Automate Where Possible** - Use system features

### Build Vendor Relationships

- Regular communication
- Prompt payments
- Fair treatment
- Feedback sharing
- Long-term partnerships
- Volume commitments

---

## Contact Information

**Internal:**
- Finance: Extension XXXX (payment queries)
- Warehouse: Extension XXXX (delivery coordination)
- MD Office: Extension XXXX (approvals)

**External:**
- Vendor inquiries: procurement@company.com
- General: +260-XXX-XXXX

---

## Quick Reference

### Your Stage in Workflow
```
Initiator → HOD → Finance → MD → YOU (Procurement) → PO → Delivery
```

### Key Tasks
1. Request 3 quotes
2. Upload quotes
3. Adjudicate
4. Create PO
5. Track delivery
6. Close requisition

### Timeframes
- Request quotes: Within 1 day
- Vendor response: 5-7 days
- Adjudication: Within 2 days
- PO issuance: Same day
- Delivery tracking: Daily updates

---

**End of Procurement Manual**
