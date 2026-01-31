const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n=== EFT REQUISITIONS TABLE SCHEMA ===\n');

const schema = db.prepare("PRAGMA table_info(eft_requisitions)").all();
console.log('Columns:');
schema.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
});

console.log('\n=== SAMPLE EFT DATA ===\n');
const samples = db.prepare('SELECT * FROM eft_requisitions LIMIT 3').all();
if (samples.length > 0) {
    console.log('Sample EFT:');
    console.log(JSON.stringify(samples[0], null, 2));
} else {
    console.log('No EFT requisitions found');
}

db.close();
