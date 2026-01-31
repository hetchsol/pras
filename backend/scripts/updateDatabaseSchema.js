const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check departments table structure
    db.all("PRAGMA table_info(departments)", [], (err, columns) => {
        if (err) {
            console.error('Error checking departments table:', err);
            return;
        }

        console.log('Departments table columns:');
        columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });

        const hasHodName = columns.some(col => col.name === 'hod_name');

        if (!hasHodName) {
            console.log('\nAdding hod_name column to departments table...');
            db.run(`ALTER TABLE departments ADD COLUMN hod_name TEXT`, (err) => {
                if (err) {
                    console.error('Error adding hod_name column:', err);
                } else {
                    console.log('✓ Added hod_name column to departments');
                }
                checkRequisitionsTable();
            });
        } else {
            console.log('\n✓ hod_name column already exists');
            checkRequisitionsTable();
        }
    });
});

function checkRequisitionsTable() {
    db.all("PRAGMA table_info(requisitions)", [], (err, columns) => {
        if (err) {
            console.error('Error checking requisitions table:', err);
            db.close();
            return;
        }

        console.log('\nRequisitions table columns:');
        columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });

        const hasTaxType = columns.some(col => col.name === 'tax_type');

        if (!hasTaxType) {
            console.log('\nAdding tax_type column to requisitions table...');
            db.run(`ALTER TABLE requisitions ADD COLUMN tax_type TEXT DEFAULT 'VAT'`, (err) => {
                if (err) {
                    console.error('Error adding tax_type column:', err);
                } else {
                    console.log('✓ Added tax_type column to requisitions');
                }
                checkUsersTable();
            });
        } else {
            console.log('\n✓ tax_type column already exists');
            checkUsersTable();
        }
    });
}

function checkUsersTable() {
    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            console.error('Error checking users table:', err);
            db.close();
            return;
        }

        console.log('\nUsers table columns:');
        columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });

        const hasAssignedHod = columns.some(col => col.name === 'assigned_hod');

        if (!hasAssignedHod) {
            console.log('\nAdding assigned_hod column to users table...');
            db.run(`ALTER TABLE users ADD COLUMN assigned_hod TEXT`, (err) => {
                if (err) {
                    console.error('Error adding assigned_hod column:', err);
                } else {
                    console.log('✓ Added assigned_hod column to users');
                }
                db.close();
            });
        } else {
            console.log('\n✓ assigned_hod column already exists');
            db.close();
        }
    });
}
