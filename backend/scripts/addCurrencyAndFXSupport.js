/**
 * Database Migration Script: Add Currency and FX Rate Support
 *
 * This script adds:
 * 1. FX rates table for managing exchange rates
 * 2. Currency columns to requisition items
 * 3. Budget spending tracking columns
 * 4. Expense tracking table
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Starting currency and FX rate migration...\n');

db.serialize(() => {
    // Create FX rates table
    db.run(`
        CREATE TABLE IF NOT EXISTS fx_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            currency_code TEXT NOT NULL,
            currency_name TEXT NOT NULL,
            rate_to_zmw REAL NOT NULL,
            updated_by INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            effective_from DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (updated_by) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating fx_rates table:', err.message);
        } else {
            console.log('✅ FX rates table created successfully');
        }
    });

    // Create FX rate history table for audit trail
    db.run(`
        CREATE TABLE IF NOT EXISTS fx_rate_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fx_rate_id INTEGER NOT NULL,
            old_rate REAL NOT NULL,
            new_rate REAL NOT NULL,
            changed_by INTEGER NOT NULL,
            change_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (fx_rate_id) REFERENCES fx_rates(id),
            FOREIGN KEY (changed_by) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating fx_rate_history table:', err.message);
        } else {
            console.log('✅ FX rate history table created successfully');
        }
    });

    // Add currency columns to requisition_items table
    db.run(`
        ALTER TABLE requisition_items ADD COLUMN currency TEXT DEFAULT 'ZMW'
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding currency column:', err.message);
        } else {
            console.log('✅ Currency column added to requisition_items');
        }
    });

    db.run(`
        ALTER TABLE requisition_items ADD COLUMN amount_in_zmw REAL DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding amount_in_zmw column:', err.message);
        } else {
            console.log('✅ Amount in ZMW column added to requisition_items');
        }
    });

    db.run(`
        ALTER TABLE requisition_items ADD COLUMN fx_rate_used REAL DEFAULT 1
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding fx_rate_used column:', err.message);
        } else {
            console.log('✅ FX rate used column added to requisition_items');
        }
    });

    // Enhance budgets table with spent tracking
    db.run(`
        ALTER TABLE budgets ADD COLUMN spent_amount REAL DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding spent_amount column:', err.message);
        } else {
            console.log('✅ Spent amount column added to budgets');
        }
    });

    db.run(`
        ALTER TABLE budgets ADD COLUMN committed_amount REAL DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding committed_amount column:', err.message);
        } else {
            console.log('✅ Committed amount column added to budgets');
        }
    });

    db.run(`
        ALTER TABLE budgets ADD COLUMN available_amount REAL DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding available_amount column:', err.message);
        } else {
            console.log('✅ Available amount column added to budgets');
        }
    });

    // Create budget expenses tracking table
    db.run(`
        CREATE TABLE IF NOT EXISTS budget_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            budget_id INTEGER NOT NULL,
            requisition_id INTEGER NOT NULL,
            department TEXT NOT NULL,
            amount REAL NOT NULL,
            fiscal_year TEXT NOT NULL,
            expense_type TEXT DEFAULT 'committed',
            recorded_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (budget_id) REFERENCES budgets(id),
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (recorded_by) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating budget_expenses table:', err.message);
        } else {
            console.log('✅ Budget expenses table created successfully');
        }
    });

    // Add budget tracking columns to requisitions
    db.run(`
        ALTER TABLE requisitions ADD COLUMN budget_checked BOOLEAN DEFAULT 0
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding budget_checked column:', err.message);
        } else {
            console.log('✅ Budget checked column added to requisitions');
        }
    });

    db.run(`
        ALTER TABLE requisitions ADD COLUMN budget_approved_by INTEGER
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding budget_approved_by column:', err.message);
        } else {
            console.log('✅ Budget approved by column added to requisitions');
        }
    });

    db.run(`
        ALTER TABLE requisitions ADD COLUMN budget_approved_at DATETIME
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding budget_approved_at column:', err.message);
        } else {
            console.log('✅ Budget approved at column added to requisitions');
        }
    });

    db.run(`
        ALTER TABLE requisitions ADD COLUMN budget_comments TEXT
    `, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Error adding budget_comments column:', err.message);
        } else {
            console.log('✅ Budget comments column added to requisitions');
        }
    });

    // Insert default FX rates
    setTimeout(() => {
        const defaultRates = [
            { code: 'ZMW', name: 'Zambian Kwacha', rate: 1.0, date: '2025-01-01' },
            { code: 'USD', name: 'US Dollar', rate: 27.50, date: '2025-01-01' },
            { code: 'EUR', name: 'Euro', rate: 29.80, date: '2025-01-01' }
        ];

        // Get admin user ID (default is 6)
        db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", (err, admin) => {
            const adminId = admin ? admin.id : 6;

            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO fx_rates (currency_code, currency_name, rate_to_zmw, updated_by, effective_from)
                VALUES (?, ?, ?, ?, ?)
            `);

            defaultRates.forEach(rate => {
                insertStmt.run([rate.code, rate.name, rate.rate, adminId, rate.date], (err) => {
                    if (err) {
                        console.error(`❌ Error inserting FX rate for ${rate.code}:`, err.message);
                    } else {
                        console.log(`✅ Added FX rate: 1 ${rate.code} = K${rate.rate} ZMW`);
                    }
                });
            });

            insertStmt.finalize();
        });
    }, 1000);
});

// Wait for all operations to complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('\n✅ Database migration complete!');
            console.log('📝 Currency and FX rate support is ready to use.');
            console.log('\n📊 New tables created:');
            console.log('   - fx_rates (exchange rate management)');
            console.log('   - fx_rate_history (audit trail)');
            console.log('   - budget_expenses (expense tracking)');
            console.log('\n💱 Default currencies added:');
            console.log('   - ZMW (Zambian Kwacha)');
            console.log('   - USD (US Dollar)');
            console.log('   - EUR (Euro)');
            console.log('\n🔒 FX rate access: Finance Manager, Procurement, Admin\n');
        }
    });
}, 3000);
