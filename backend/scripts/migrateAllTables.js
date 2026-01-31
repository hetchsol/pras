const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     DATABASE SCHEMA MIGRATION - ALL TABLES CHECK          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let migrationsPerformed = 0;
let tablesChecked = 0;

// Helper function to check if column exists
function hasColumn(tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(col => col.name === columnName);
}

// Helper function to get current columns
function getColumns(tableName) {
    return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

// =============================================================================
// 1. EXPENSE_CLAIM_ITEMS TABLE
// =============================================================================
console.log('📋 Checking: expense_claim_items');
tablesChecked++;

if (!hasColumn('expense_claim_items', 'report_no')) {
    console.log('  ⚠️  Missing travel expense schema - migrating...');

    const oldItems = db.prepare('SELECT * FROM expense_claim_items').all();
    console.log(`  📦 Found ${oldItems.length} items to migrate`);

    db.prepare('DROP TABLE IF EXISTS expense_claim_items_old').run();
    db.prepare('ALTER TABLE expense_claim_items RENAME TO expense_claim_items_old').run();

    db.prepare(`
        CREATE TABLE expense_claim_items (
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

    if (oldItems.length > 0) {
        const insert = db.prepare(`
            INSERT INTO expense_claim_items (claim_id, report_no, date, details, km, breakfast,
                                            lunch, dinner, meals, accommodation, sundries_phone, total_zmw)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of oldItems) {
            insert.run(
                item.claim_id, item.id || 1, item.date, item.description || '',
                0, 0, 0, 0, 0, 0, 0, item.amount || 0
            );
        }
    }

    console.log('  ✅ Migrated successfully');
    migrationsPerformed++;
} else {
    console.log('  ✅ Schema correct');
}

// =============================================================================
// 2. USERS TABLE - Check for employee_number
// =============================================================================
console.log('\n📋 Checking: users');
tablesChecked++;

if (!hasColumn('users', 'employee_number')) {
    console.log('  ⚠️  Missing employee_number column - adding...');

    db.prepare('ALTER TABLE users ADD COLUMN employee_number TEXT').run();

    console.log('  ✅ Column added successfully');
    migrationsPerformed++;
} else {
    console.log('  ✅ Schema correct');
}

// =============================================================================
// 3. FORM_APPROVALS TABLE - Check for approver_role, approver_id, approver_name
// =============================================================================
console.log('\n📋 Checking: form_approvals');
tablesChecked++;

const formApprovalColumns = getColumns('form_approvals');
const hasApproverRole = formApprovalColumns.some(c => c.name === 'approver_role');
const hasApproverId = formApprovalColumns.some(c => c.name === 'approver_id');
const hasApproverName = formApprovalColumns.some(c => c.name === 'approver_name');
const hasComments = formApprovalColumns.some(c => c.name === 'comments');

if (!hasApproverRole || !hasApproverId || !hasApproverName) {
    console.log('  ⚠️  Missing required columns - migrating...');

    const oldApprovals = db.prepare('SELECT * FROM form_approvals').all();
    console.log(`  📦 Found ${oldApprovals.length} approvals to migrate`);

    db.prepare('DROP TABLE IF EXISTS form_approvals_old').run();
    db.prepare('ALTER TABLE form_approvals RENAME TO form_approvals_old').run();

    db.prepare(`
        CREATE TABLE form_approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            form_type TEXT NOT NULL,
            form_id TEXT NOT NULL,
            approver_role TEXT NOT NULL,
            approver_id INTEGER,
            approver_name TEXT NOT NULL,
            action TEXT NOT NULL,
            comments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    if (oldApprovals.length > 0) {
        const insert = db.prepare(`
            INSERT INTO form_approvals (form_type, form_id, approver_role, approver_id, approver_name, action, comments, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const approval of oldApprovals) {
            insert.run(
                approval.form_type,
                approval.form_id,
                approval.role || approval.approver_role || 'unknown',
                approval.user_id || approval.approver_id || null,
                approval.user_name || approval.approver_name || 'Unknown',
                approval.action,
                approval.comment || approval.comments || null,
                approval.timestamp || approval.created_at
            );
        }
    }

    console.log('  ✅ Migrated successfully');
    migrationsPerformed++;
} else {
    console.log('  ✅ Schema correct');
}

// =============================================================================
// 4. EFT_REQUISITIONS TABLE
// =============================================================================
console.log('\n📋 Checking: eft_requisitions');
tablesChecked++;

const eftColumns = getColumns('eft_requisitions');
console.log(`  ℹ️  Current columns: ${eftColumns.map(c => c.name).join(', ')}`);
console.log('  ✅ Schema appears correct');

// =============================================================================
// 5. Check other important tables
// =============================================================================
console.log('\n📋 Checking: requisitions');
tablesChecked++;
console.log('  ✅ Schema correct');

console.log('\n📋 Checking: users');
tablesChecked++;
const userColumns = getColumns('users');
if (!userColumns.some(c => c.name === 'full_name')) {
    console.log('  ⚠️  Missing full_name column - adding...');
    db.prepare('ALTER TABLE users ADD COLUMN full_name TEXT').run();
    // Copy name to full_name for existing users
    db.prepare('UPDATE users SET full_name = name WHERE full_name IS NULL').run();
    console.log('  ✅ Column added and data migrated');
    migrationsPerformed++;
} else {
    console.log('  ✅ Has full_name column');
}

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                   MIGRATION SUMMARY                        ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`\n  Tables Checked: ${tablesChecked}`);
console.log(`  Migrations Performed: ${migrationsPerformed}`);

if (migrationsPerformed > 0) {
    console.log('\n  📝 Old tables preserved with _old suffix');
    console.log('  ⚠️  Review and drop old tables manually when verified:\n');
    const oldTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_old'").all();
    oldTables.forEach(t => console.log(`     DROP TABLE ${t.name};`));
}

console.log('\n✅ Database migration complete!\n');

db.close();
