const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./purchase_requisition.db');

const queries = [
    'ALTER TABLE purchase_orders ADD COLUMN unit_price REAL DEFAULT 0',
    'ALTER TABLE purchase_orders ADD COLUMN quantity REAL DEFAULT 0',
    'ALTER TABLE purchase_orders ADD COLUMN subtotal REAL DEFAULT 0',
    'ALTER TABLE purchase_orders ADD COLUMN vat_rate REAL DEFAULT 16.0',
    'ALTER TABLE purchase_orders ADD COLUMN vat_amount REAL DEFAULT 0',
    'ALTER TABLE purchase_orders ADD COLUMN grand_total REAL DEFAULT 0',
    'ALTER TABLE purchase_orders ADD COLUMN currency TEXT DEFAULT "ZMW"',
    'ALTER TABLE purchase_orders ADD COLUMN selected_vendor TEXT'
];

let completed = 0;

console.log('Adding columns to purchase_orders table...\n');

queries.forEach((query, index) => {
    db.run(query, (err) => {
        if (err) {
            if (err.message.includes('duplicate')) {
                console.log(`Column ${index + 1}/8: Already exists (skipped)`);
            } else {
                console.error(`Column ${index + 1}/8: Error - ${err.message}`);
            }
        } else {
            console.log(`Column ${index + 1}/8: Added successfully`);
        }

        completed++;
        if (completed === queries.length) {
            console.log('\n✅ All columns processed');

            // Verify the table structure
            db.all('PRAGMA table_info(purchase_orders)', (err, columns) => {
                if (err) {
                    console.error('Error getting table info:', err);
                } else {
                    console.log('\nCurrent purchase_orders table structure:');
                    columns.forEach(col => {
                        console.log(`  - ${col.name}: ${col.type}`);
                    });
                }
                db.close();
            });
        }
    });
});
