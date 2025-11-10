const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(adjudications)", [], (err, columns) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log('\nAdjudications Table Structure:');
    console.log('='.repeat(50));
    columns.forEach(col => {
        console.log(`  ${col.name.padEnd(30)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
    });
    console.log('\n');
    db.close();
});
