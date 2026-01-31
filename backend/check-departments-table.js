const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('purchase_requisition.db');

console.log('\n=== Checking Departments Table ===\n');

// Check if table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='departments'", (err, tables) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    if (tables.length === 0) {
        console.log('❌ departments table does NOT exist');
        console.log('\nCreating departments table...');

        db.run(`
            CREATE TABLE IF NOT EXISTS departments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                code TEXT NOT NULL UNIQUE,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            } else {
                console.log('✅ departments table created successfully');
            }
            checkDepartments();
        });
    } else {
        console.log('✅ departments table exists');

        // Check table structure
        db.all("PRAGMA table_info(departments)", (err, columns) => {
            if (err) {
                console.error('Error getting table info:', err);
            } else {
                console.log('\nTable Structure:');
                columns.forEach(col => {
                    console.log(`  - ${col.name} (${col.type})`);
                });
            }
            checkDepartments();
        });
    }
});

function checkDepartments() {
    db.all("SELECT * FROM departments", (err, departments) => {
        if (err) {
            console.error('Error fetching departments:', err);
            db.close();
            return;
        }

        console.log(`\n✅ Found ${departments.length} departments:\n`);
        if (departments.length === 0) {
            console.log('No departments in database');
        } else {
            departments.forEach(dept => {
                console.log(`ID: ${dept.id}`);
                console.log(`  Name: ${dept.name || 'NULL'}`);
                console.log(`  Code: ${dept.code || 'NULL'}`);
                console.log(`  Description: ${dept.description || 'NULL'}`);
                console.log(`  Active: ${dept.is_active}`);
                console.log('');
            });
        }

        db.close();
    });
}
