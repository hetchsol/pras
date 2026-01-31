const Database = require('better-sqlite3');
const path = require('path');

console.log('📋 Adding Forms Tables to purchase_requisition.db\n');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

try {
    // Create EFT Requisitions table
    console.log('Creating eft_requisitions table...');
    db.prepare(`
        CREATE TABLE IF NOT EXISTS eft_requisitions (
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (initiator_id) REFERENCES users(id)
        )
    `).run();
    console.log('✅ eft_requisitions table created\n');

    // Create Expense Claims table
    console.log('Creating expense_claims table...');
    db.prepare(`
        CREATE TABLE IF NOT EXISTS expense_claims (
            id TEXT PRIMARY KEY,
            claim_number INTEGER,
            claimant_name TEXT NOT NULL,
            department TEXT NOT NULL,
            period_from DATE NOT NULL,
            period_to DATE NOT NULL,
            total_amount REAL NOT NULL,
            initiator_id INTEGER NOT NULL,
            initiator_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_finance',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (initiator_id) REFERENCES users(id)
        )
    `).run();
    console.log('✅ expense_claims table created\n');

    // Create Expense Claim Items table
    console.log('Creating expense_claim_items table...');
    db.prepare(`
        CREATE TABLE IF NOT EXISTS expense_claim_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claim_id TEXT NOT NULL,
            date DATE NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            receipt_attached BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE
        )
    `).run();
    console.log('✅ expense_claim_items table created\n');

    // Create Form Approvals table
    console.log('Creating form_approvals table...');
    db.prepare(`
        CREATE TABLE IF NOT EXISTS form_approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            form_id TEXT NOT NULL,
            form_type TEXT NOT NULL,
            approver_role TEXT NOT NULL,
            approver_id INTEGER,
            approver_name TEXT,
            action TEXT,
            comments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (approver_id) REFERENCES users(id)
        )
    `).run();
    console.log('✅ form_approvals table created\n');

    // Verify tables were created
    const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('eft_requisitions', 'expense_claims', 'expense_claim_items', 'form_approvals')
        ORDER BY name
    `).all();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Forms Tables Added Successfully!\n');
    console.log('📊 Tables created:');
    tables.forEach(t => console.log(`   ✅ ${t.name}`));
    console.log('\n📌 Forms system is now ready to use!\n');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

db.close();
process.exit(0);
