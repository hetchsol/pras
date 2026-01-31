/**
 * Database Migration Script: Add Pricing Fields to Purchase Orders Table
 *
 * Adds comprehensive pricing breakdown fields to purchase_orders table:
 * - unit_price, quantity, subtotal
 * - vat_rate, vat_amount, grand_total
 * - currency
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'requisitions.db');
const db = new Database(dbPath);

console.log('🔄 Starting migration: Add PO Pricing Fields...\n');

try {
    // First, create purchase_orders table if it doesn't exist
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number TEXT UNIQUE NOT NULL,
            requisition_id INTEGER NOT NULL,
            total_amount REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            issued_to_vendor TEXT,
            delivery_date DATE,
            terms_conditions TEXT,
            notes TEXT,
            generated_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id),
            FOREIGN KEY (generated_by) REFERENCES users(id)
        )
    `);
    console.log('✅ purchase_orders table created/verified\n');

    // Add new columns to purchase_orders table
    db.exec(`
        -- Add unit_price column
        ALTER TABLE purchase_orders ADD COLUMN unit_price REAL DEFAULT 0;
    `);
    console.log('✅ Added column: unit_price');

    db.exec(`
        -- Add quantity column
        ALTER TABLE purchase_orders ADD COLUMN quantity INTEGER DEFAULT 1;
    `);
    console.log('✅ Added column: quantity');

    db.exec(`
        -- Add subtotal column (quantity × unit_price)
        ALTER TABLE purchase_orders ADD COLUMN subtotal REAL DEFAULT 0;
    `);
    console.log('✅ Added column: subtotal');

    db.exec(`
        -- Add VAT rate column (default 16%)
        ALTER TABLE purchase_orders ADD COLUMN vat_rate REAL DEFAULT 16.0;
    `);
    console.log('✅ Added column: vat_rate');

    db.exec(`
        -- Add VAT amount column
        ALTER TABLE purchase_orders ADD COLUMN vat_amount REAL DEFAULT 0;
    `);
    console.log('✅ Added column: vat_amount');

    db.exec(`
        -- Add grand total column (subtotal + vat_amount)
        ALTER TABLE purchase_orders ADD COLUMN grand_total REAL DEFAULT 0;
    `);
    console.log('✅ Added column: grand_total');

    db.exec(`
        -- Add currency column
        ALTER TABLE purchase_orders ADD COLUMN currency TEXT DEFAULT 'ZMW';
    `);
    console.log('✅ Added column: currency');

    db.exec(`
        -- Add selected vendor column
        ALTER TABLE purchase_orders ADD COLUMN selected_vendor TEXT;
    `);
    console.log('✅ Added column: selected_vendor');

    console.log('\n✅ Migration completed successfully!');
    console.log('📊 Purchase orders table now includes comprehensive pricing fields.\n');

} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('⚠️  Columns already exist - migration may have been run before');
    } else {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
} finally {
    db.close();
}
