const Database = require('better-sqlite3');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const db1 = new Database(path.join(backendDir, 'requisitions.db'));
const db2 = new Database(path.join(backendDir, 'purchase_requisition.db'));

console.log('📊 Schema Comparison\n');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔍 requisitions.db - users table schema:');
const schema1 = db1.prepare("PRAGMA table_info(users)").all();
schema1.forEach(col => {
    console.log(`   ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
});

console.log('\n🔍 purchase_requisition.db - users table schema:');
const schema2 = db2.prepare("PRAGMA table_info(users)").all();
schema2.forEach(col => {
    console.log(`   ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
});

console.log('\n═══════════════════════════════════════════════════════════\n');

db1.close();
db2.close();
