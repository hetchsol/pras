# Quick Reference Guide - Version 3.0

## 🚀 Quick Start

### Start the Server
```bash
cd backend
npm start
```
Server runs on: `http://localhost:3001`

---

## 👤 Default Users

| Username | Password | Role | Access |
|----------|----------|------|--------|
| sarah.banda | password123 | Finance Manager | Budget & FX management |
| david.mulenga | password123 | MD | Budget oversight & reports |
| james.phiri | password123 | Procurement | Multi-currency items |
| admin | admin123 | Admin | Full access |

---

## 💱 FX Rates Quick Reference

### View Active Rates
```bash
GET /api/fx-rates
```

### Update USD Rate
```bash
POST /api/fx-rates
{
  "currency_code": "USD",
  "currency_name": "US Dollar",
  "rate_to_zmw": 28.00,
  "effective_from": "2025-11-01",
  "change_reason": "Monthly update"
}
```

### Default Rates
- **ZMW:** 1.00 (base currency)
- **USD:** 27.50
- **EUR:** 29.80

---

## 💰 Budget Management Quick Reference

### View All Budgets
```bash
GET /api/budgets/overview?fiscal_year=2025
```

### Check Department Budget
```bash
GET /api/budgets/department/IT?fiscal_year=2025
```

### Approve Budget for Requisition
```bash
POST /api/requisitions/:id/budget-check
{
  "approved": true,
  "comments": "Budget approved"
}
```

### Default Budgets (2025)
- **IT:** K500,000
- **Finance:** K400,000
- **HR:** K300,000
- **Operations:** K600,000

---

## 🛒 Multi-Currency Items

### Add Item in USD
```bash
POST /api/requisitions/:id/items
{
  "item_name": "Laptop",
  "quantity": 5,
  "unit_price": 1500,
  "currency": "USD",
  "vendor_id": 1
}
```

### Add Item in EUR
```bash
POST /api/requisitions/:id/items
{
  "item_name": "Printer",
  "quantity": 3,
  "unit_price": 800,
  "currency": "EUR",
  "vendor_id": 2
}
```

### Add Item in ZMW
```bash
POST /api/requisitions/:id/items
{
  "item_name": "Office Chair",
  "quantity": 10,
  "unit_price": 1200,
  "currency": "ZMW",
  "vendor_id": 3
}
```

**Supported Currencies:** USD, EUR, ZMW

---

## 📊 Reports Quick Reference

### Excel Reports
```bash
# Requisitions
GET /api/reports/requisitions/excel?dateFrom=2025-01-01&dateTo=2025-12-31

# Budgets
GET /api/reports/budgets/excel?fiscal_year=2025

# FX Rates
GET /api/reports/fx-rates/excel
```

### PDF Reports
```bash
# Requisitions
GET /api/reports/requisitions/pdf?dateFrom=2025-01-01

# Budgets
GET /api/reports/budgets/pdf?fiscal_year=2025

# Department Spending
GET /api/reports/department/IT/pdf?fiscal_year=2025
```

---

## 🔐 Role Access Matrix

| Feature | Finance | MD | Procurement | Admin |
|---------|---------|-----|-------------|-------|
| Manage FX Rates | ✅ | ❌ | ✅ | ✅ |
| Manage Budgets | ✅ | ✅ | ❌ | ✅ |
| Approve Budget | ✅ | ❌ | ❌ | ✅ |
| Select Currency | ❌ | ❌ | ✅ | ✅ |
| Generate Reports | ✅ | ✅ | ❌ | ✅ |

---

## 🔄 Complete Workflow

```
1. Initiator creates requisition
2. HOD approves/rejects
3. Finance Manager checks budget → Commits funds
4. Procurement adds items (multi-currency)
5. System auto-converts to ZMW
6. Procurement completes purchase
7. Generate PDF/Excel reports
```

---

## 📝 Common Tasks

### Check Budget Before Creating Requisition
```bash
GET /api/budgets/department/IT?fiscal_year=2025
```

### Create Multi-Currency Requisition
1. Create requisition: `POST /api/requisitions`
2. Add USD items: `POST /api/requisitions/:id/items` (currency: "USD")
3. Add EUR items: `POST /api/requisitions/:id/items` (currency: "EUR")
4. Add ZMW items: `POST /api/requisitions/:id/items` (currency: "ZMW")
5. Submit: `PUT /api/requisitions/:id/submit`

### Monthly FX Rate Update
1. Login as Finance Manager
2. Update USD: `POST /api/fx-rates` (currency_code: "USD")
3. Update EUR: `POST /api/fx-rates` (currency_code: "EUR")
4. Verify: `GET /api/fx-rates`

### Generate Monthly Reports
```bash
# Requisitions for the month
GET /api/reports/requisitions/excel?dateFrom=2025-10-01&dateTo=2025-10-31

# Budget status
GET /api/reports/budgets/pdf?fiscal_year=2025

# All departments
GET /api/reports/department/IT/pdf
GET /api/reports/department/Finance/pdf
GET /api/reports/department/HR/pdf
```

---

## 🆘 Troubleshooting

### Problem: FX Rate Not Found
**Solution:** Run migration: `node scripts/addCurrencyAndFXSupport.js`

### Problem: Budget Table Missing
**Solution:** Run migration: `node scripts/addBudgetsTable.js`

### Problem: Currency Not Accepted
**Solution:** Use only USD, EUR, or ZMW (case-sensitive)

### Problem: Budget Rejection
**Solution:** Check available budget with `GET /api/budgets/department/:dept`

---

## 📚 Documentation Files

- **BUDGET_FX_AND_REPORTING_GUIDE.md** - Complete guide (40+ pages)
- **IMPLEMENTATION_SUMMARY_V3.0.md** - Implementation details
- **QUICK_REFERENCE_V3.0.md** - This file
- **WORKFLOW_GUIDE.md** - Workflow documentation
- **API_TESTING.md** - API testing examples

---

## 🎯 Key Points

1. **All amounts stored in ZMW** - Original currency preserved
2. **FX rate tracked per item** - Audit trail maintained
3. **Budget auto-commits** - When Finance Manager approves
4. **3 currencies supported** - USD, EUR, ZMW
5. **2 report formats** - PDF (presentation) & Excel (analysis)

---

**Version:** 3.0.0 | **Status:** ✅ Production Ready
