/**
 * Database Migration Script: Add Form Fields to Requisitions
 *
 * This script adds the missing form fields to the requisitions table:
 * - delivery_location
 * - urgency
 * - required_date
 * - account_code
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding form fields to requisitions table...\n');

db.serialize(() => {
    // Add columns to requisitions table
    const columnsToAdd = [
        { name: 'delivery_location', type: 'TEXT', description: 'Delivery location for items' },
        { name: 'urgency', type: 'TEXT', description: 'Urgency level (Low, Medium, High, Urgent)' },
        { name: 'required_date', type: 'DATE', description: 'Required by date' },
        { name: 'account_code', type: 'TEXT', description: 'Account code for budgeting' }
    ];

    columnsToAdd.forEach(column => {
        db.run(
            `ALTER TABLE requisitions ADD COLUMN ${column.name} ${column.type}`,
            (err) => {
                if (err) {
                    if (err.message.includes('duplicate column name')) {
                        console.log(`⚠️  Column ${column.name} already exists (skipped)`);
                    } else {
                        console.error(`❌ Error adding ${column.name}:`, err.message);
                    }
                } else {
                    console.log(`✅ Added column: ${column.name} - ${column.description}`);
                }
            }
        );
    });
});

// Wait for all operations to complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('\n✅ Database migration complete!');
            console.log('📝 Form fields are ready to use.\n');
        }
    });
}, 2000);
