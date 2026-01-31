/**
 * CONSOLIDATED DATABASE CREATION SCRIPT
 *
 * This script creates a complete, consolidated database with ALL required tables
 * for the Purchase Requisition System. It includes all fields from various migration
 * scripts to ensure the database is complete and ready for use.
 *
 * Tables created:
 * 1. users - User accounts with roles and departments
 * 2. departments - Department management
 * 3. department_codes - Department sub-codes
 * 4. vendors - Vendor registry
 * 5. fx_rates - Foreign exchange rates
 * 6. fx_rate_history - FX rate change audit trail
 * 7. budgets - Departmental budgets
 * 8. requisitions - Purchase requisitions (comprehensive)
 * 9. requisition_items - Line items for requisitions
 * 10. approvals - Approval workflow tracking
 * 11. purchase_orders - Generated purchase orders (with pricing)
 * 12. vendor_quotes - Vendor quotations
 * 13. adjudications - Quote evaluation and vendor selection
 * 14. audit_log - System audit trail
 * 15. refresh_tokens - JWT refresh token management
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'requisitions.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🔄 Starting Consolidated Database Creation...\n');
console.log('📍 Database location:', dbPath);
console.log('\n========================================\n');

try {
    // ============================================
    // 1. USERS TABLE
    // ============================================
    console.log('Creating users table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL,
            department TEXT,
            is_hod BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Users table created\n');

    // ============================================
    // 2. DEPARTMENTS TABLE
    // ============================================
    console.log('Creating departments table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Departments table created\n');

    // ============================================
    // 3. DEPARTMENT CODES TABLE
    // ============================================
    console.log('Creating department_codes table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS department_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            department_id INTEGER,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        )
    `);
    console.log('✅ Department codes table created\n');

    // ============================================
    // 4. VENDORS TABLE
    // ============================================
    console.log('Creating vendors table...');
    db.exec(`
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
    `);
    console.log('✅ Vendors table created\n');

    // ============================================
    // 5. FX RATES TABLE
    // ============================================
    console.log('Creating fx_rates table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS fx_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            currency_code TEXT NOT NULL,
            currency_name TEXT NOT NULL,
            rate_to_zmw REAL NOT NULL,
            updated_by INTEGER,
            is_active BOOLEAN DEFAULT 1,
            effective_from DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (updated_by) REFERENCES users(id)
        )
    `);
    console.log('✅ FX rates table created\n');

    // ============================================
    // 6. FX RATE HISTORY TABLE
    // ============================================
    console.log('Creating fx_rate_history table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS fx_rate_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fx_rate_id INTEGER NOT NULL,
            old_rate REAL NOT NULL,
            new_rate REAL NOT NULL,
            changed_by INTEGER NOT NULL,
            change_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (fx_rate_id) REFERENCES fx_rates(id),
            FOREIGN KEY (changed_by) REFERENCES users(id)
        )
    `);
    console.log('✅ FX rate history table created\n');

    // ============================================
    // 7. BUDGETS TABLE
    // ============================================
    console.log('Creating budgets table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            department TEXT NOT NULL UNIQUE,
            allocated_amount REAL NOT NULL DEFAULT 0,
            spent_amount REAL DEFAULT 0,
            fiscal_year TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Budgets table created\n');

    // ============================================
    // 8. REQUISITIONS TABLE (COMPREHENSIVE)
    // ============================================
    console.log('Creating requisitions table (comprehensive)...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS requisitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            req_number TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            delivery_location TEXT,
            urgency TEXT DEFAULT 'Medium',
            required_date DATE,
            account_code TEXT,
            created_by INTEGER NOT NULL,
            department TEXT,
            status TEXT DEFAULT 'draft',

            -- HOD approval fields
            hod_approval_status TEXT DEFAULT 'pending',
            hod_approved_by INTEGER,
            hod_approved_at DATETIME,
            hod_comments TEXT,
            assigned_hod_id INTEGER,

            -- Procurement fields
            vendor_code TEXT,
            selected_vendor TEXT,
            vendor_currency TEXT DEFAULT 'ZMW',
            unit_price REAL,
            quantity INTEGER,
            total_cost REAL,

            -- Finance approval fields
            finance_approval_status TEXT DEFAULT 'pending',
            finance_approved_by INTEGER,
            finance_approved_at DATETIME,
            finance_comments TEXT,

            -- Budget check fields
            budget_checked BOOLEAN DEFAULT 0,
            budget_approved_by INTEGER,
            budget_approved_at DATETIME,
            budget_comments TEXT,

            -- MD approval fields
            md_approval_status TEXT DEFAULT 'pending',
            md_approved_by INTEGER,
            md_approved_at DATETIME,
            md_comments TEXT,

            -- PO tracking
            po_number TEXT,
            po_generated_at DATETIME,
            po_generated_by INTEGER,

            -- Quotes and adjudication tracking
            has_quotes INTEGER DEFAULT 0,
            has_adjudication INTEGER DEFAULT 0,

            -- Total amount
            total_amount REAL DEFAULT 0,

            -- Timestamps
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (hod_approved_by) REFERENCES users(id),
            FOREIGN KEY (assigned_hod_id) REFERENCES users(id),
            FOREIGN KEY (finance_approved_by) REFERENCES users(id),
            FOREIGN KEY (budget_approved_by) REFERENCES users(id),
            FOREIGN KEY (md_approved_by) REFERENCES users(id),
            FOREIGN KEY (po_generated_by) REFERENCES users(id)
        )
    `);
    console.log('✅ Requisitions table created\n');

    // ============================================
    // 9. REQUISITION ITEMS TABLE
    // ============================================
    console.log('Creating requisition_items table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS requisition_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL DEFAULT 0,
            total_price REAL DEFAULT 0,
            specifications TEXT,
            vendor_id INTEGER,
            currency TEXT DEFAULT 'ZMW',
            amount_in_zmw REAL DEFAULT 0,
            fx_rate_used REAL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        )
    `);
    console.log('✅ Requisition items table created\n');

    // ============================================
    // 10. APPROVALS TABLE
    // ============================================
    console.log('Creating approvals table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            action TEXT NOT NULL,
            comment TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ Approvals table created\n');

    // ============================================
    // 11. PURCHASE ORDERS TABLE (WITH PRICING)
    // ============================================
    console.log('Creating purchase_orders table (with pricing fields)...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number TEXT UNIQUE NOT NULL,
            requisition_id INTEGER NOT NULL,
            total_amount REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            issued_to_vendor TEXT,
            delivery_date DATE,
            terms_conditions TEXT,
            notes TEXT,
            generated_by INTEGER NOT NULL,

            -- Pricing breakdown fields
            unit_price REAL DEFAULT 0,
            quantity INTEGER DEFAULT 1,
            subtotal REAL DEFAULT 0,
            vat_rate REAL DEFAULT 16.0,
            vat_amount REAL DEFAULT 0,
            grand_total REAL DEFAULT 0,
            currency TEXT DEFAULT 'ZMW',
            selected_vendor TEXT,

            -- Timestamps
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (generated_by) REFERENCES users(id)
        )
    `);
    console.log('✅ Purchase orders table created\n');

    // ============================================
    // 12. VENDOR QUOTES TABLE
    // ============================================
    console.log('Creating vendor_quotes table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS vendor_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            vendor_id INTEGER NOT NULL,
            vendor_name TEXT NOT NULL,
            quote_number TEXT,
            quote_amount REAL NOT NULL,
            currency TEXT DEFAULT 'ZMW',
            quote_file_path TEXT NOT NULL,
            quote_file_name TEXT NOT NULL,
            uploaded_by INTEGER NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (vendor_id) REFERENCES vendors(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
    `);
    console.log('✅ Vendor quotes table created\n');

    // ============================================
    // 13. ADJUDICATIONS TABLE
    // ============================================
    console.log('Creating adjudications table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS adjudications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            recommended_vendor_id INTEGER NOT NULL,
            recommended_vendor_name TEXT NOT NULL,
            recommended_amount REAL NOT NULL,
            currency TEXT DEFAULT 'ZMW',
            summary TEXT NOT NULL,
            evaluation_criteria TEXT,
            technical_compliance TEXT,
            pricing_analysis TEXT,
            delivery_terms TEXT,
            payment_terms TEXT,
            recommendation_rationale TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending',
            reviewed_by_finance INTEGER,
            reviewed_by_md INTEGER,
            finance_comments TEXT,
            md_comments TEXT,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (recommended_vendor_id) REFERENCES vendors(id),
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (reviewed_by_finance) REFERENCES users(id),
            FOREIGN KEY (reviewed_by_md) REFERENCES users(id)
        )
    `);
    console.log('✅ Adjudications table created\n');

    // ============================================
    // 14. AUDIT LOG TABLE
    // ============================================
    console.log('Creating audit_log table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ Audit log table created\n');

    // ============================================
    // 15. REFRESH TOKENS TABLE
    // ============================================
    console.log('Creating refresh_tokens table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    console.log('✅ Refresh tokens table created\n');

    console.log('========================================\n');
    console.log('🌱 Seeding default data...\n');

    // ============================================
    // SEED DATA: USERS
    // ============================================
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
        console.log('Seeding default users...');
        const hashedPassword = bcrypt.hashSync('password123', 10);
        const adminPassword = bcrypt.hashSync('admin123', 10);

        const insertUser = db.prepare(`
            INSERT INTO users (username, password, full_name, email, role, department, is_hod)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const defaultUsers = [
            ['john.banda', hashedPassword, 'John Banda', 'john@company.zm', 'initiator', 'IT', 0],
            ['mary.mwanza', hashedPassword, 'Mary Mwanza', 'mary@company.zm', 'hod', 'IT', 1],
            ['james.phiri', hashedPassword, 'James Phiri', 'james@company.zm', 'procurement', 'Procurement', 0],
            ['sarah.banda', hashedPassword, 'Sarah Banda', 'sarah@company.zm', 'finance', 'Finance', 1],
            ['david.mulenga', hashedPassword, 'David Mulenga', 'david@company.zm', 'md', 'Executive', 0],
            ['admin', adminPassword, 'System Admin', 'admin@company.zm', 'admin', 'IT', 0]
        ];

        defaultUsers.forEach(user => insertUser.run(user));
        console.log('✅ Default users created');
    } else {
        console.log('ℹ️  Users already exist, skipping seed');
    }

    // ============================================
    // SEED DATA: DEPARTMENTS
    // ============================================
    const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
    if (deptCount === 0) {
        console.log('Seeding default departments...');
        const insertDept = db.prepare(`
            INSERT INTO departments (name, code, description, is_active)
            VALUES (?, ?, ?, ?)
        `);

        const defaultDepartments = [
            ['IT', 'IT', 'Information Technology Department', 1],
            ['HR', 'HR', 'Human Resources Department', 1],
            ['Finance', 'FIN', 'Finance Department', 1],
            ['Operations', 'OPS', 'Operations Department', 1],
            ['Procurement', 'PROC', 'Procurement Department', 1],
            ['Executive', 'EXEC', 'Executive Management', 1]
        ];

        defaultDepartments.forEach(dept => insertDept.run(dept));
        console.log('✅ Default departments created');
    } else {
        console.log('ℹ️  Departments already exist, skipping seed');
    }

    // ============================================
    // SEED DATA: VENDORS
    // ============================================
    const vendorCount = db.prepare('SELECT COUNT(*) as count FROM vendors').get().count;
    if (vendorCount === 0) {
        console.log('Seeding default vendors...');
        const insertVendor = db.prepare(`
            INSERT INTO vendors (name, code, tier, rating, category, status, email, phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const defaultVendors = [
            ['Tech Solutions Ltd', 'TSL001', 1, 4.5, 'Technology', 'active', 'sales@techsolutions.zm', '+260 211 123456'],
            ['Office Supplies Co', 'OSC002', 1, 4.8, 'Office Supplies', 'active', 'info@officesupplies.zm', '+260 211 234567'],
            ['Hardware Plus', 'HWP003', 2, 4.2, 'Hardware', 'active', 'sales@hardwareplus.zm', '+260 211 345678'],
            ['Zambia Furniture Co', 'ZFC004', 2, 4.0, 'Furniture', 'active', 'orders@zamfurniture.zm', '+260 211 456789'],
            ['Medical Supplies Ltd', 'MSL005', 1, 4.9, 'Medical', 'active', 'info@medsupplies.zm', '+260 211 567890']
        ];

        defaultVendors.forEach(vendor => insertVendor.run(vendor));
        console.log('✅ Default vendors created');
    } else {
        console.log('ℹ️  Vendors already exist, skipping seed');
    }

    // ============================================
    // SEED DATA: BUDGETS
    // ============================================
    const budgetCount = db.prepare('SELECT COUNT(*) as count FROM budgets').get().count;
    if (budgetCount === 0) {
        console.log('Seeding default budgets...');
        const insertBudget = db.prepare(`
            INSERT INTO budgets (department, allocated_amount, spent_amount, fiscal_year)
            VALUES (?, ?, ?, ?)
        `);

        const defaultBudgets = [
            ['IT', 500000, 0, '2025'],
            ['HR', 300000, 0, '2025'],
            ['Finance', 400000, 0, '2025'],
            ['Operations', 600000, 0, '2025'],
            ['Procurement', 200000, 0, '2025'],
            ['Executive', 800000, 0, '2025']
        ];

        defaultBudgets.forEach(budget => insertBudget.run(budget));
        console.log('✅ Default budgets created');
    } else {
        console.log('ℹ️  Budgets already exist, skipping seed');
    }

    // ============================================
    // SEED DATA: FX RATES
    // ============================================
    const fxCount = db.prepare('SELECT COUNT(*) as count FROM fx_rates').get().count;
    if (fxCount === 0) {
        console.log('Seeding default FX rates...');
        const insertFX = db.prepare(`
            INSERT INTO fx_rates (currency_code, currency_name, rate_to_zmw, is_active, effective_from)
            VALUES (?, ?, ?, ?, date('now'))
        `);

        const defaultFXRates = [
            ['USD', 'US Dollar', 27.50, 1],
            ['EUR', 'Euro', 30.00, 1],
            ['GBP', 'British Pound', 35.00, 1],
            ['ZAR', 'South African Rand', 1.50, 1],
            ['ZMW', 'Zambian Kwacha', 1.00, 1]
        ];

        defaultFXRates.forEach(fx => insertFX.run(fx));
        console.log('✅ Default FX rates created');
    } else {
        console.log('ℹ️  FX rates already exist, skipping seed');
    }

    console.log('\n========================================\n');
    console.log('✅ CONSOLIDATED DATABASE CREATED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log('   - 15 tables created');
    console.log('   - Default users, departments, vendors, budgets, and FX rates seeded');
    console.log('   - Foreign key constraints enabled');
    console.log('   - WAL mode enabled for better performance\n');
    console.log('📍 Database location:', dbPath);
    console.log('\n🎉 Database is ready for use!\n');

} catch (error) {
    console.error('❌ Error during database consolidation:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
} finally {
    db.close();
}
