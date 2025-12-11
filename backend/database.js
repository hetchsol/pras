const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Create tables
const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Vendors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code VARCHAR(255) UNIQUE NOT NULL,
        tier INTEGER NOT NULL,
        rating REAL NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Departments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        budget REAL NOT NULL,
        spent REAL DEFAULT 0
      )
    `);

    // FX Rates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fx_rates (
        id SERIAL PRIMARY KEY,
        currency_code TEXT NOT NULL,
        currency_name TEXT NOT NULL,
        rate_to_zmw REAL NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Requisitions table
    await client.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (initiator_id) REFERENCES users(id)
      )
    `);

    // Approvals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        requisition_id TEXT NOT NULL,
        role TEXT NOT NULL,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        comment TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', err);
    throw err;
  } finally {
    client.release();
  }
};

// CRUD Operations

// Users
const getUsers = async () => {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
};

const getUserByUsername = async (username) => {
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0];
};

const getUserById = async (id) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
};

const createUser = async (user) => {
  const result = await pool.query(
    `INSERT INTO users (username, password, name, role, department, email)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user.username, user.password, user.name, user.role, user.department, user.email]
  );
  return result.rows[0];
};

const deleteUser = async (id) => {
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

// Vendors
const getVendors = async () => {
  const result = await pool.query('SELECT * FROM vendors');
  return result.rows;
};

const createVendor = async (vendor) => {
  const result = await pool.query(
    `INSERT INTO vendors (name, code, tier, rating, category, status, email, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [vendor.name, vendor.code, vendor.tier, vendor.rating, vendor.category, vendor.status, vendor.email, vendor.phone]
  );
  return result.rows[0];
};

const deleteVendor = async (id) => {
  const result = await pool.query('DELETE FROM vendors WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

// Departments
const getDepartments = async () => {
  const result = await pool.query('SELECT * FROM departments');
  return result.rows;
};

// Requisitions
const getRequisitions = async () => {
  const result = await pool.query('SELECT * FROM requisitions');
  return result.rows;
};

const getRequisitionById = async (id) => {
  const result = await pool.query('SELECT * FROM requisitions WHERE id = $1', [id]);
  return result.rows[0];
};

const createRequisition = async (req) => {
  const result = await pool.query(
    `INSERT INTO requisitions (id, description, quantity, estimated_cost, amount, justification,
                             department, urgency, initiator_id, initiator_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [req.id, req.description, req.quantity, req.estimatedCost, req.amount, req.justification,
     req.department, req.urgency, req.initiatorId, req.initiatorName, req.status]
  );
  return result.rows[0];
};

const updateRequisitionStatus = async (id, status, selectedVendor = null) => {
  let query, params;
  if (selectedVendor) {
    query = 'UPDATE requisitions SET status = $1, selected_vendor = $2 WHERE id = $3 RETURNING *';
    params = [status, selectedVendor, id];
  } else {
    query = 'UPDATE requisitions SET status = $1 WHERE id = $2 RETURNING *';
    params = [status, id];
  }
  const result = await pool.query(query, params);
  return result.rows[0];
};

const updateRequisitionByProcurement = async (id, data) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (data.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(data.description); }
  if (data.quantity !== undefined) { fields.push(`quantity = $${paramIndex++}`); values.push(data.quantity); }
  if (data.selected_vendor !== undefined) { fields.push(`selected_vendor = $${paramIndex++}`); values.push(data.selected_vendor); }
  if (data.vendor_currency !== undefined) { fields.push(`vendor_currency = $${paramIndex++}`); values.push(data.vendor_currency); }
  if (data.unit_price !== undefined) { fields.push(`unit_price = $${paramIndex++}`); values.push(data.unit_price); }
  if (data.total_cost !== undefined) { fields.push(`total_cost = $${paramIndex++}`); values.push(data.total_cost); }
  if (data.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(data.status); }
  if (data.justification !== undefined) { fields.push(`justification = $${paramIndex++}`); values.push(data.justification); }
  if (data.urgency !== undefined) { fields.push(`urgency = $${paramIndex++}`); values.push(data.urgency); }

  values.push(id);

  const result = await pool.query(
    `UPDATE requisitions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
};

// Approvals
const getApprovalsByRequisitionId = async (reqId) => {
  const result = await pool.query(
    'SELECT * FROM approvals WHERE requisition_id = $1 ORDER BY timestamp ASC',
    [reqId]
  );
  return result.rows;
};

const createApproval = async (approval) => {
  const result = await pool.query(
    `INSERT INTO approvals (requisition_id, role, user_name, action, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [approval.requisition_id, approval.role, approval.userName, approval.action, approval.comment]
  );
  return result.rows[0];
};

// FX Rates
const getFXRates = async () => {
  const result = await pool.query('SELECT * FROM fx_rates WHERE is_active = true');
  return result.rows;
};

const getAllFXRates = async () => {
  const result = await pool.query('SELECT * FROM fx_rates');
  return result.rows;
};

const createFXRate = async (fxRate) => {
  const result = await pool.query(
    `INSERT INTO fx_rates (currency_code, currency_name, rate_to_zmw, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING *`,
    [fxRate.currency_code, fxRate.currency_name, fxRate.rate_to_zmw]
  );
  return result.rows[0];
};

const updateFXRate = async (id, rate_to_zmw) => {
  const result = await pool.query(
    'UPDATE fx_rates SET rate_to_zmw = $1 WHERE id = $2 RETURNING *',
    [rate_to_zmw, id]
  );
  return result.rows[0];
};

module.exports = {
  pool,
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
  updateFXRate
};
