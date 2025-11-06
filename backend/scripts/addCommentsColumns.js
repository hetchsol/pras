/**
 * Database Migration Script: Add Comments Columns
 *
 * This script adds comment columns for HOD, Finance, and MD approvals:
 * - hod_comments
 * - finance_comments
 * - md_comments
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding comments columns to requisitions table...\n');

db.serialize(() => {
    // Add columns to requisitions table
    const columnsToAdd = [
        { name: 'hod_comments', type: 'TEXT', description: 'HOD approval/rejection comments' },
        { name: 'finance_comments', type: 'TEXT', description: 'Finance approval/rejection comments' },
        { name: 'md_comments', type: 'TEXT', description: 'MD approval/rejection comments' }
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
            console.log('📝 Comments columns are ready to use.\n');
        }
    });
}, 2000);
