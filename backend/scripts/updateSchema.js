const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new Database(dbPath);

console.log('🔍 Checking current requisitions schema...\n');

// Get current schema
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='requisitions'").get();
console.log('Current schema:');
console.log(schema.sql);
console.log('\n---\n');

// Check if finance and MD columns exist
const tableInfo = db.prepare("PRAGMA table_info(requisitions)").all();
console.log('Current columns:');
tableInfo.forEach(col => {
    console.log(`- ${col.name} (${col.type})`);
});

const hasFinanceApproval = tableInfo.some(col => col.name === 'finance_approval_status');
const hasMDApproval = tableInfo.some(col => col.name === 'md_approval_status');

console.log('\n---\n');

if (!hasFinanceApproval || !hasMDApproval) {
    console.log('⚠️  Missing columns detected. Adding...\n');

    try {
        db.exec(`
            -- Add Finance approval columns
            ALTER TABLE requisitions ADD COLUMN finance_approval_status TEXT DEFAULT 'pending';
            ALTER TABLE requisitions ADD COLUMN finance_approved_by INTEGER;
            ALTER TABLE requisitions ADD COLUMN finance_approved_at DATETIME;
            ALTER TABLE requisitions ADD COLUMN finance_comments TEXT;

            -- Add MD approval columns
            ALTER TABLE requisitions ADD COLUMN md_approval_status TEXT DEFAULT 'pending';
            ALTER TABLE requisitions ADD COLUMN md_approved_by INTEGER;
            ALTER TABLE requisitions ADD COLUMN md_approved_at DATETIME;
            ALTER TABLE requisitions ADD COLUMN md_comments TEXT;

            -- Add PO tracking columns
            ALTER TABLE requisitions ADD COLUMN po_number TEXT;
            ALTER TABLE requisitions ADD COLUMN po_generated_at DATETIME;
            ALTER TABLE requisitions ADD COLUMN po_generated_by INTEGER;
        `);

        console.log('✅ Schema updated successfully!\n');

        // Verify
        const updatedInfo = db.prepare("PRAGMA table_info(requisitions)").all();
        console.log('Updated columns:');
        updatedInfo.forEach(col => {
            console.log(`- ${col.name} (${col.type})`);
        });
    } catch (error) {
        // Columns might already exist, check individual adds
        console.log('Some columns may already exist. Checking individually...');

        const addColumnSafely = (columnDef, columnName) => {
            try {
                db.exec(`ALTER TABLE requisitions ADD COLUMN ${columnDef}`);
                console.log(`✅ Added ${columnName}`);
            } catch (err) {
                if (err.message.includes('duplicate column')) {
                    console.log(`ℹ️  ${columnName} already exists`);
                } else {
                    console.error(`❌ Error adding ${columnName}:`, err.message);
                }
            }
        };

        addColumnSafely('finance_approval_status TEXT DEFAULT "pending"', 'finance_approval_status');
        addColumnSafely('finance_approved_by INTEGER', 'finance_approved_by');
        addColumnSafely('finance_approved_at DATETIME', 'finance_approved_at');
        addColumnSafely('finance_comments TEXT', 'finance_comments');

        addColumnSafely('md_approval_status TEXT DEFAULT "pending"', 'md_approval_status');
        addColumnSafely('md_approved_by INTEGER', 'md_approved_by');
        addColumnSafely('md_approved_at DATETIME', 'md_approved_at');
        addColumnSafely('md_comments TEXT', 'md_comments');

        addColumnSafely('po_number TEXT', 'po_number');
        addColumnSafely('po_generated_at DATETIME', 'po_generated_at');
        addColumnSafely('po_generated_by INTEGER', 'po_generated_by');
    }
} else {
    console.log('✅ All required columns exist!\n');
}

// Create purchase_orders table if it doesn't exist
console.log('\n---\n');
console.log('🔍 Checking purchase_orders table...\n');

try {
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (generated_by) REFERENCES users(id)
        )
    `);
    console.log('✅ purchase_orders table created/verified\n');
} catch (error) {
    console.error('❌ Error creating purchase_orders table:', error.message);
}

db.close();
console.log('\n✅ Database schema update complete!');
