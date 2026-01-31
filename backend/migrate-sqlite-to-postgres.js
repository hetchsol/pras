require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const sqliteDb = new sqlite3.Database('./purchase_requisition.db');

async function migrate() {
  try {
    console.log('🔄 Migrating SQLite to PostgreSQL...\n');

    // Drop all tables
    console.log('Dropping all PostgreSQL tables...');
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    console.log('✅ All tables dropped\n');

    // Create tables in the correct order (respecting foreign keys)
    console.log('Creating tables...\n');

    // Create users table first (no dependencies)
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL,
        department TEXT,
        is_hod BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_hod INTEGER,
        employee_number TEXT
      )
    `);
    console.log('✅ Created users table');

    // Create vendors table (no dependencies)
    await pool.query(`
      CREATE TABLE vendors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        tier INTEGER NOT NULL,
        rating REAL NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        type TEXT,
        currency TEXT DEFAULT 'ZMW',
        country TEXT,
        tax_id TEXT
      )
    `);
    console.log('✅ Created vendors table');

    // Create departments table
    await pool.query(`
      CREATE TABLE departments (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        hod_name TEXT
      )
    `);
    console.log('✅ Created departments table');

    // Create requisitions table
    await pool.query(`
      CREATE TABLE requisitions (
        id SERIAL PRIMARY KEY,
        req_number TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        delivery_location TEXT,
        urgency TEXT DEFAULT 'Medium',
        required_date DATE,
        account_code TEXT,
        created_by INTEGER NOT NULL,
        status TEXT DEFAULT 'draft',
        hod_approval_status TEXT DEFAULT 'pending',
        hod_approved_by INTEGER,
        hod_approved_at TIMESTAMP,
        hod_comments TEXT,
        total_amount REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        budget_checked BOOLEAN DEFAULT FALSE,
        budget_approved_by INTEGER,
        budget_approved_at TIMESTAMP,
        budget_comments TEXT,
        finance_approval_status TEXT DEFAULT 'pending',
        finance_approved_by INTEGER,
        finance_approved_at TIMESTAMP,
        finance_comments TEXT,
        md_approval_status TEXT DEFAULT 'pending',
        md_approved_by INTEGER,
        md_approved_at TIMESTAMP,
        md_comments TEXT,
        po_number TEXT,
        po_generated_at TIMESTAMP,
        po_generated_by INTEGER,
        selected_vendor INTEGER,
        vendor_currency TEXT DEFAULT 'ZMW',
        unit_price REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        justification TEXT,
        quantity INTEGER,
        procurement_status TEXT DEFAULT 'pending',
        procurement_assigned_to INTEGER,
        procurement_completed_at TIMESTAMP,
        procurement_comments TEXT,
        rejected_by INTEGER,
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        assigned_hod_id INTEGER,
        has_quotes INTEGER DEFAULT 0,
        has_adjudication INTEGER DEFAULT 0,
        vendor_code TEXT,
        tax_type TEXT DEFAULT 'VAT',
        assigned_to INTEGER,
        assigned_role TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    console.log('✅ Created requisitions table');

    // Create refresh_tokens table
    await pool.query(`
      CREATE TABLE refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked BOOLEAN DEFAULT FALSE,
        revoked_at TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created refresh_tokens table');

    // Create requisition_items table
    await pool.query(`
      CREATE TABLE requisition_items (
        id SERIAL PRIMARY KEY,
        requisition_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        specifications TEXT,
        vendor_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        currency TEXT DEFAULT 'ZMW',
        amount_in_zmw REAL DEFAULT 0,
        fx_rate_used REAL DEFAULT 1,
        FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
      )
    `);
    console.log('✅ Created requisition_items table');

    // Create audit_log table
    await pool.query(`
      CREATE TABLE audit_log (
        id SERIAL PRIMARY KEY,
        requisition_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Created audit_log table');

    // Create remaining tables...
    await pool.query(`
      CREATE TABLE fx_rates (
        id SERIAL PRIMARY KEY,
        currency_code TEXT NOT NULL,
        currency_name TEXT NOT NULL,
        rate_to_zmw REAL NOT NULL,
        updated_by INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        effective_from DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )
    `);
    console.log('✅ Created fx_rates table');

    await pool.query(`
      CREATE TABLE budgets (
        id SERIAL PRIMARY KEY,
        department TEXT NOT NULL UNIQUE,
        allocated_amount REAL NOT NULL DEFAULT 0,
        fiscal_year TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        spent_amount REAL DEFAULT 0,
        committed_amount REAL DEFAULT 0,
        available_amount REAL DEFAULT 0
      )
    `);
    console.log('✅ Created budgets table');

   // Add forms tables
    await pool.query(`
      CREATE TABLE eft_requisitions (
        id TEXT PRIMARY KEY,
        eft_chq_number INTEGER,
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
        status TEXT NOT NULL DEFAULT 'pending_finance',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (initiator_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Created eft_requisitions table');

    await pool.query(`
      CREATE TABLE expense_claims (
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (initiator_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Created expense_claims table');

    await pool.query(`
      CREATE TABLE expense_claim_items (
        id SERIAL PRIMARY KEY,
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
    `);
    console.log('✅ Created expense_claim_items table');

    await pool.query(`
      CREATE TABLE petty_cash_requisitions (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        amount_in_words TEXT NOT NULL,
        payee_name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        description TEXT,
        department TEXT NOT NULL,
        initiator_id INTEGER NOT NULL,
        initiator_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (initiator_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Created petty_cash_requisitions table');

    await pool.query(`
      CREATE TABLE petty_cash_items (
        id SERIAL PRIMARY KEY,
        requisition_id TEXT NOT NULL,
        item_no INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (requisition_id) REFERENCES petty_cash_requisitions(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created petty_cash_items table');

    await pool.query(`
      CREATE TABLE form_approvals (
        id SERIAL PRIMARY KEY,
        form_id TEXT NOT NULL,
        form_type TEXT NOT NULL,
        approver_role TEXT NOT NULL,
        approver_id INTEGER,
        approver_name TEXT,
        action TEXT,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (approver_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Created form_approvals table');

    await pool.query(`
      CREATE TABLE regional_expense_approvers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        full_name TEXT NOT NULL,
        departments TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Created regional_expense_approvers table');

    console.log('\n📦 Copying data from SQLite...\n');

    // Copy data from SQLite to PostgreSQL
    await copyTable('users');
    await copyTable('vendors');
    await copyTable('departments');
    await copyTable('requisitions');
    await copyTable('refresh_tokens');
    await copyTable('requisition_items');
    await copyTable('audit_log');
    await copyTable('fx_rates');
    await copyTable('budgets');
    await copyTable('eft_requisitions');
    await copyTable('expense_claims');
    await copyTable('expense_claim_items');
    await copyTable('petty_cash_requisitions');
    await copyTable('petty_cash_items');
    await copyTable('form_approvals');
    await copyTable('regional_expense_approvers');

    console.log('\n🎉 Migration complete!\n');
    sqliteDb.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    sqliteDb.close();
    await pool.end();
    process.exit(1);
  }
}

function copyTable(tableName) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
      if (err) {
        console.error(`❌ Error reading ${tableName}:`, err.message);
        return resolve();
      }

      if (rows.length === 0) {
        console.log(`⏭️  Skipping ${tableName} (empty)`);
        return resolve();
      }

      console.log(`📋 Copying ${rows.length} rows to ${tableName}...`);

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.join(', ');

        try {
          await pool.query(
            `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
            values
          );
        } catch (error) {
          if (error.code !== '23503' && error.code !== '23505') {
            console.error(`  ❌ Error inserting into ${tableName}:`, error.message);
          }
        }
      }

      console.log(`✅ Copied ${tableName}\n`);
      resolve();
    });
  });
}

migrate();
