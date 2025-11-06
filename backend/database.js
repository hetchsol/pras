const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'requisitions.db'));
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

  console.log('✅ Database tables created successfully');
};

// CRUD Operations

// Users
const getUsers = () => db.prepare('SELECT * FROM users').all();
const getUserByUsername = (username) => db.prepare('SELECT * FROM users WHERE username = ?').get(username);
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

module.exports = {
  db,
  createTables,
  // Users
  getUsers,
  getUserByUsername,
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
  updateFXRate
};