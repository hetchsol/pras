const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

const schema = db.prepare("PRAGMA table_info(requisitions)").all();
console.log('\nRequisitions table schema:');
schema.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
});

db.close();
