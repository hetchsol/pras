const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.prepare('PRAGMA foreign_keys = ON').run();

// Create tables
const createTables = () => {
  // Users table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Vendors table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      tier INTEGER NOT NULL,
      rating REAL NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Departments table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      budget REAL NOT NULL,
      spent REAL DEFAULT 0
    )
  `).run();

  // FX Rates table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS fx_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency_code TEXT NOT NULL,
      currency_name TEXT NOT NULL,
      rate_to_zmw REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Requisitions table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS requisitions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      estimated_cost REAL NOT NULL,
      amount REAL NOT NULL,
      justification TEXT NOT NULL,
      department TEXT NOT NULL,
      urgency TEXT NOT NULL,
      initiator_id INTEGER NOT NULL,
      initiator_name TEXT NOT NULL,
      status TEXT NOT NULL,
      selected_vendor TEXT,
      vendor_currency TEXT DEFAULT 'ZMW',
      unit_price REAL,
      total_cost REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    )
  `).run();

  // Approvals table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requisition_id TEXT NOT NULL,
      role TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
    )
  `).run();

  // Expense Claims table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS expense_claims (
      id TEXT PRIMARY KEY,
      employee_name TEXT NOT NULL,
      employee_number TEXT NOT NULL,
      department TEXT NOT NULL,
      reason_for_trip TEXT NOT NULL,
      total_kilometers REAL DEFAULT 0,
      km_rate REAL DEFAULT 0,
      sub_total REAL DEFAULT 0,
      total_travel REAL DEFAULT 0,
      total_claim REAL DEFAULT 0,
      amount_advanced REAL DEFAULT 0,
      amount_due REAL DEFAULT 0,
      initiator_id INTEGER NOT NULL,
      initiator_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    )
  `).run();

  // Expense Claim Line Items table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS expense_claim_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id TEXT NOT NULL,
      report_no INTEGER NOT NULL,
      date TEXT NOT NULL,
      details TEXT NOT NULL,
      km REAL DEFAULT 0,
      breakfast INTEGER DEFAULT 0,
      lunch INTEGER DEFAULT 0,
      dinner INTEGER DEFAULT 0,
      meals REAL DEFAULT 0,
      accommodation REAL DEFAULT 0,
      sundries_phone REAL DEFAULT 0,
      total_zmw REAL DEFAULT 0,
      FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE
    )
  `).run();

  // EFT/Cheque Requisitions table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS eft_requisitions (
      id TEXT PRIMARY KEY,
      eft_chq_number TEXT,
      amount REAL NOT NULL,
      amount_in_words TEXT NOT NULL,
      in_favour_of TEXT NOT NULL,
      bank_account_number TEXT,
      bank_name TEXT,
      branch TEXT,
      purpose TEXT NOT NULL,
      account_code TEXT,
      description TEXT,
      initiator_id INTEGER NOT NULL,
      initiator_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    )
  `).run();

  // Form Approvals table (for both expense claims and EFT forms)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS form_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_type TEXT NOT NULL,
      form_id TEXT NOT NULL,
      role TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  console.log('✅ Database tables created successfully');
};

// CRUD Operations

// Users
const getUsers = () => {
  const users = db.prepare('SELECT * FROM users').all();
  // Map full_name to name for compatibility
  return users.map(u => ({ ...u, name: u.full_name || u.name }));
};
const getUserByUsername = (username) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (user) user.name = user.full_name || user.name;
  return user;
};
const getUserById = (id) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (user) user.name = user.full_name || user.name;
  return user;
};
const createUser = (user) => {
  return db.prepare(`
    INSERT INTO users (username, password, name, role, department, email)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.username, user.password, user.name, user.role, user.department, user.email);
};
const deleteUser = (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id);

// Vendors
const getVendors = () => db.prepare('SELECT * FROM vendors').all();
const createVendor = (vendor) => {
  return db.prepare(`
    INSERT INTO vendors (name, code, tier, rating, category, status, email, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(vendor.name, vendor.code, vendor.tier, vendor.rating, vendor.category, vendor.status, vendor.email, vendor.phone);
};
const deleteVendor = (id) => db.prepare('DELETE FROM vendors WHERE id = ?').run(id);

// Departments
const getDepartments = () => db.prepare('SELECT * FROM departments').all();

// Requisitions
const getRequisitions = () => db.prepare('SELECT * FROM requisitions').all();
const getRequisitionById = (id) => db.prepare('SELECT * FROM requisitions WHERE id = ?').get(id);
const createRequisition = (req) => {
  return db.prepare(`
    INSERT INTO requisitions (id, description, quantity, estimated_cost, amount, justification, 
                             department, urgency, initiator_id, initiator_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.id, req.description, req.quantity, req.estimatedCost, req.amount, req.justification,
         req.department, req.urgency, req.initiatorId, req.initiatorName, req.status);
};
const updateRequisitionStatus = (id, status, selectedVendor = null) => {
  if (selectedVendor) {
    return db.prepare('UPDATE requisitions SET status = ?, selected_vendor = ? WHERE id = ?')
      .run(status, selectedVendor, id);
  }
  return db.prepare('UPDATE requisitions SET status = ? WHERE id = ?').run(status, id);
};

const updateRequisitionByProcurement = (id, data) => {
  const fields = [];
  const values = [];

  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.quantity !== undefined) { fields.push('quantity = ?'); values.push(data.quantity); }
  if (data.selected_vendor !== undefined) { fields.push('selected_vendor = ?'); values.push(data.selected_vendor); }
  if (data.vendor_currency !== undefined) { fields.push('vendor_currency = ?'); values.push(data.vendor_currency); }
  if (data.unit_price !== undefined) { fields.push('unit_price = ?'); values.push(data.unit_price); }
  if (data.total_cost !== undefined) { fields.push('total_cost = ?'); values.push(data.total_cost); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.justification !== undefined) { fields.push('justification = ?'); values.push(data.justification); }
  if (data.urgency !== undefined) { fields.push('urgency = ?'); values.push(data.urgency); }

  values.push(id);

  return db.prepare(`UPDATE requisitions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
};

// Approvals
const getApprovalsByRequisitionId = (reqId) => {
  return db.prepare('SELECT * FROM approvals WHERE requisition_id = ? ORDER BY timestamp ASC').all(reqId);
};
const createApproval = (approval) => {
  return db.prepare(`
    INSERT INTO approvals (requisition_id, role, user_name, action, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(approval.requisition_id, approval.role, approval.userName, approval.action, approval.comment);
};

// FX Rates
const getFXRates = () => db.prepare('SELECT * FROM fx_rates WHERE is_active = 1').all();
const getAllFXRates = () => db.prepare('SELECT * FROM fx_rates').all();
const createFXRate = (fxRate) => {
  return db.prepare(`
    INSERT INTO fx_rates (currency_code, currency_name, rate_to_zmw, is_active)
    VALUES (?, ?, ?, 1)
  `).run(fxRate.currency_code, fxRate.currency_name, fxRate.rate_to_zmw);
};
const updateFXRate = (id, rate_to_zmw) => {
  return db.prepare('UPDATE fx_rates SET rate_to_zmw = ? WHERE id = ?').run(rate_to_zmw, id);
};

// Expense Claims
const getExpenseClaims = () => db.prepare('SELECT * FROM expense_claims ORDER BY created_at DESC').all();
const getExpenseClaimById = (id) => db.prepare('SELECT * FROM expense_claims WHERE id = ?').get(id);
const createExpenseClaim = (claim) => {
  return db.prepare(`
    INSERT INTO expense_claims (id, employee_name, employee_number, department, reason_for_trip,
                                 total_kilometers, km_rate, sub_total, total_travel, total_claim,
                                 amount_advanced, amount_due, initiator_id, initiator_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(claim.id, claim.employee_name, claim.employee_number, claim.department, claim.reason_for_trip,
         claim.total_kilometers || 0, claim.km_rate || 0, claim.sub_total || 0, claim.total_travel || 0,
         claim.total_claim || 0, claim.amount_advanced || 0, claim.amount_due || 0,
         claim.initiator_id, claim.initiator_name, claim.status);
};
const updateExpenseClaimStatus = (id, status) => {
  return db.prepare('UPDATE expense_claims SET status = ? WHERE id = ?').run(status, id);
};
const updateExpenseClaimTotals = (id, totals) => {
  return db.prepare(`
    UPDATE expense_claims
    SET total_kilometers = ?, sub_total = ?, total_travel = ?, total_claim = ?, amount_due = ?
    WHERE id = ?
  `).run(totals.total_kilometers, totals.sub_total, totals.total_travel,
         totals.total_claim, totals.amount_due, id);
};

// Expense Claim Items
const getExpenseClaimItems = (claimId) => {
  return db.prepare('SELECT * FROM expense_claim_items WHERE claim_id = ? ORDER BY report_no ASC').all(claimId);
};
const createExpenseClaimItem = (item) => {
  return db.prepare(`
    INSERT INTO expense_claim_items (claim_id, report_no, date, details, km, breakfast, lunch, dinner,
                                      meals, accommodation, sundries_phone, total_zmw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.claim_id, item.report_no, item.date, item.details, item.km || 0,
         item.breakfast || 0, item.lunch || 0, item.dinner || 0, item.meals || 0,
         item.accommodation || 0, item.sundries_phone || 0, item.total_zmw || 0);
};
const updateExpenseClaimItem = (id, item) => {
  return db.prepare(`
    UPDATE expense_claim_items
    SET date = ?, details = ?, km = ?, breakfast = ?, lunch = ?, dinner = ?,
        meals = ?, accommodation = ?, sundries_phone = ?, total_zmw = ?
    WHERE id = ?
  `).run(item.date, item.details, item.km, item.breakfast, item.lunch, item.dinner,
         item.meals, item.accommodation, item.sundries_phone, item.total_zmw, id);
};
const deleteExpenseClaimItem = (id) => {
  return db.prepare('DELETE FROM expense_claim_items WHERE id = ?').run(id);
};

// EFT Requisitions
const getEFTRequisitions = () => db.prepare('SELECT * FROM eft_requisitions ORDER BY created_at DESC').all();
const getEFTRequisitionById = (id) => db.prepare('SELECT * FROM eft_requisitions WHERE id = ?').get(id);
const createEFTRequisition = (eft) => {
  return db.prepare(`
    INSERT INTO eft_requisitions (id, eft_chq_number, amount, amount_in_words, in_favour_of,
                                   bank_account_number, bank_name, branch,
                                   purpose, account_code, description, initiator_id, initiator_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(eft.id, eft.eft_chq_number || null, eft.amount, eft.amount_in_words, eft.in_favour_of,
         eft.bank_account_number || null, eft.bank_name || null, eft.branch || null,
         eft.purpose, eft.account_code || null, eft.description || null,
         eft.initiator_id, eft.initiator_name, eft.status);
};
const updateEFTRequisitionStatus = (id, status) => {
  return db.prepare('UPDATE eft_requisitions SET status = ? WHERE id = ?').run(status, id);
};
const updateEFTRequisitionNumber = (id, eft_chq_number) => {
  return db.prepare('UPDATE eft_requisitions SET eft_chq_number = ? WHERE id = ?').run(eft_chq_number, id);
};

// Form Approvals
const getFormApprovals = (formType, formId) => {
  return db.prepare('SELECT * FROM form_approvals WHERE form_type = ? AND form_id = ? ORDER BY created_at ASC')
    .all(formType, formId);
};
const createFormApproval = (approval) => {
  return db.prepare(`
    INSERT INTO form_approvals (form_type, form_id, approver_role, approver_id, approver_name, action, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(approval.form_type, approval.form_id, approval.approver_role, approval.approver_id || null,
         approval.approver_name, approval.action, approval.comments || null);
};

// Regional Expense Approvers (ONLY for Expense Claims)
const getRegionalExpenseApprovers = () => {
  return db.prepare('SELECT * FROM regional_expense_approvers').all();
};
const getRegionalApproverForDepartment = (department) => {
  const approvers = db.prepare('SELECT * FROM regional_expense_approvers').all();
  for (const approver of approvers) {
    const depts = approver.departments.split(',');
    if (depts.includes(department)) {
      return approver;
    }
  }
  return null;
};
const isRegionalExpenseApprover = (userId) => {
  const result = db.prepare('SELECT COUNT(*) as count FROM regional_expense_approvers WHERE user_id = ?')
    .get(userId);
  return result.count > 0;
};

module.exports = {
  db,
  createTables,
  // Users
  getUsers,
  getUserByUsername,
  getUserById,
  createUser,
  deleteUser,
  // Vendors
  getVendors,
  createVendor,
  deleteVendor,
  // Departments
  getDepartments,
  // Requisitions
  getRequisitions,
  getRequisitionById,
  createRequisition,
  updateRequisitionStatus,
  updateRequisitionByProcurement,
  // Approvals
  getApprovalsByRequisitionId,
  createApproval,
  // FX Rates
  getFXRates,
  getAllFXRates,
  createFXRate,
  updateFXRate,
  // Expense Claims
  getExpenseClaims,
  getExpenseClaimById,
  createExpenseClaim,
  updateExpenseClaimStatus,
  updateExpenseClaimTotals,
  // Expense Claim Items
  getExpenseClaimItems,
  createExpenseClaimItem,
  updateExpenseClaimItem,
  deleteExpenseClaimItem,
  // EFT Requisitions
  getEFTRequisitions,
  getEFTRequisitionById,
  createEFTRequisition,
  updateEFTRequisitionStatus,
  updateEFTRequisitionNumber,
  // Form Approvals
  getFormApprovals,
  createFormApproval,
  // Regional Expense Approvers
  getRegionalExpenseApprovers,
  getRegionalApproverForDepartment,
  isRegionalExpenseApprover
};