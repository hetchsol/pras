/**
 * Database Migration Script: Add Budgets Table
 *
 * Creates a budgets table to manage departmental budgets
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Creating budgets table...\n');

db.serialize(() => {
    // Create budgets table
    db.run(`
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            department TEXT NOT NULL UNIQUE,
            allocated_amount REAL NOT NULL DEFAULT 0,
            fiscal_year TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating budgets table:', err.message);
        } else {
            console.log('✅ Budgets table created successfully');
        }
    });

    // Insert sample budgets
    const sampleBudgets = [
        { department: 'IT', allocated_amount: 500000, fiscal_year: '2025' },
        { department: 'HR', allocated_amount: 300000, fiscal_year: '2025' },
        { department: 'Finance', allocated_amount: 400000, fiscal_year: '2025' },
        { department: 'Operations', allocated_amount: 600000, fiscal_year: '2025' }
    ];

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO budgets (department, allocated_amount, fiscal_year)
        VALUES (?, ?, ?)
    `);

    sampleBudgets.forEach(budget => {
        insertStmt.run([budget.department, budget.allocated_amount, budget.fiscal_year], (err) => {
            if (err) {
                console.error(`❌ Error inserting budget for ${budget.department}:`, err.message);
            } else {
                console.log(`✅ Added budget for ${budget.department}: K${budget.allocated_amount.toLocaleString()}`);
            }
        });
    });

    insertStmt.finalize();
});

// Wait for all operations to complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('\n✅ Database migration complete!');
            console.log('📝 Budgets table is ready to use.\n');
        }
    });
}, 2000);
