const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new Database(dbPath);

console.log('🔍 Checking requisitions table columns...\n');

const tableInfo = db.prepare("PRAGMA table_info(requisitions)").all();
console.log('Columns in requisitions table:');
tableInfo.forEach(col => {
    console.log(`  - ${col.name.padEnd(30)} (${col.type})`);
});

console.log('\n🔍 Checking for specific columns needed for procurement...\n');

const neededColumns = [
    'selected_vendor',
    'vendor_currency',
    'unit_price',
    'total_cost',
    'justification',
    'status'
];

neededColumns.forEach(colName => {
    const exists = tableInfo.some(col => col.name === colName);
    console.log(`  ${exists ? '✅' : '❌'} ${colName}`);
});

console.log('\n🔍 Checking current requisition statuses...\n');

const statuses = db.prepare(`
    SELECT DISTINCT status, COUNT(*) as count
    FROM requisitions
    GROUP BY status
`).all();

console.log('Current statuses in database:');
statuses.forEach(s => {
    console.log(`  - ${s.status}: ${s.count} requisition(s)`);
});

console.log('\n🔍 Sample requisition data...\n');

const sample = db.prepare(`
    SELECT id, req_number, status, hod_approval_status, finance_approval_status, md_approval_status
    FROM requisitions
    ORDER BY id DESC
    LIMIT 5
`).all();

console.log('Recent requisitions:');
sample.forEach(r => {
    console.log(`  ID: ${r.id}, Status: ${r.status}, HOD: ${r.hod_approval_status || 'N/A'}, Finance: ${r.finance_approval_status || 'N/A'}, MD: ${r.md_approval_status || 'N/A'}`);
});

db.close();
