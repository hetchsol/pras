const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new Database(dbPath);

console.log('🔧 Adding missing procurement columns to requisitions table...\n');

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

// Add procurement-specific columns
addColumnSafely('selected_vendor INTEGER', 'selected_vendor');
addColumnSafely('vendor_currency TEXT DEFAULT "ZMW"', 'vendor_currency');
addColumnSafely('unit_price REAL DEFAULT 0', 'unit_price');
addColumnSafely('total_cost REAL DEFAULT 0', 'total_cost');
addColumnSafely('justification TEXT', 'justification');
addColumnSafely('quantity INTEGER', 'quantity');

// Add procurement tracking columns
addColumnSafely('procurement_status TEXT DEFAULT "pending"', 'procurement_status');
addColumnSafely('procurement_assigned_to INTEGER', 'procurement_assigned_to');
addColumnSafely('procurement_completed_at DATETIME', 'procurement_completed_at');
addColumnSafely('procurement_comments TEXT', 'procurement_comments');

// Add rejection tracking columns
addColumnSafely('rejected_by INTEGER', 'rejected_by');
addColumnSafely('rejected_at DATETIME', 'rejected_at');
addColumnSafely('rejection_reason TEXT', 'rejection_reason');

console.log('\n✅ Schema update complete!');

// Verify
console.log('\n🔍 Verifying columns...\n');
const tableInfo = db.prepare("PRAGMA table_info(requisitions)").all();
const procurementColumns = ['selected_vendor', 'vendor_currency', 'unit_price', 'total_cost', 'justification', 'quantity', 'procurement_status'];

procurementColumns.forEach(colName => {
    const exists = tableInfo.some(col => col.name === colName);
    console.log(`  ${exists ? '✅' : '❌'} ${colName}`);
});

db.close();
