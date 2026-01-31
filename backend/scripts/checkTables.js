const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

console.log('\n📋 Tables in purchase_requisition.db:\n');

const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
`).all();

tables.forEach(t => {
    console.log(`   📊 ${t.name}`);

    // Get column count
    const columns = db.prepare(`PRAGMA table_info(${t.name})`).all();
    console.log(`      └─ ${columns.length} columns\n`);
});

console.log(`✅ Total tables: ${tables.length}\n`);

// Check specifically for forms tables
console.log('🔍 Forms-related tables:');
const formsTables = ['eft_requisitions', 'expense_claims', 'expense_claim_items', 'form_approvals'];
formsTables.forEach(table => {
    const exists = tables.find(t => t.name === table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
});

db.close();
