/**
 * Database Migration Script: Enhance Requisition Workflow
 *
 * This script adds support for:
 * - Requisition redirections (admin can redirect to another approver)
 * - Rejection tracking with reasons
 * - Procurement stage tracking
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Enhancing workflow tables...\n');

db.serialize(() => {
    // Create redirections table
    db.run(`
        CREATE TABLE IF NOT EXISTS requisition_redirections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requisition_id INTEGER NOT NULL,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            redirected_by INTEGER NOT NULL,
            reason TEXT NOT NULL,
            stage TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id),
            FOREIGN KEY (redirected_by) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating redirections table:', err.message);
        } else {
            console.log('✅ requisition_redirections table created successfully');
        }
    });

    // Add columns to requisitions table for enhanced workflow
    const columnsToAdd = [
        { name: 'rejection_reason', type: 'TEXT', description: 'Reason for rejection' },
        { name: 'rejected_by', type: 'INTEGER', description: 'User who rejected' },
        { name: 'rejected_at', type: 'DATETIME', description: 'When rejected' },
        { name: 'procurement_status', type: 'TEXT DEFAULT "pending"', description: 'Procurement stage status' },
        { name: 'procurement_assigned_to', type: 'INTEGER', description: 'Procurement officer assigned' },
        { name: 'procurement_completed_at', type: 'DATETIME', description: 'When procurement completed' },
        { name: 'procurement_comments', type: 'TEXT', description: 'Procurement comments' },
        { name: 'current_approver_id', type: 'INTEGER', description: 'Current approver (for redirections)' },
        { name: 'is_redirected', type: 'BOOLEAN DEFAULT 0', description: 'Whether requisition was redirected' }
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

    // Create indexes for better performance
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_redirections_requisition
        ON requisition_redirections(requisition_id)
    `, (err) => {
        if (err) {
            console.error('❌ Error creating index:', err.message);
        } else {
            console.log('✅ Index on requisition_id created');
        }
    });

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_requisitions_status
        ON requisitions(status)
    `, (err) => {
        if (err) {
            console.error('❌ Error creating index:', err.message);
        } else {
            console.log('✅ Index on requisitions.status created');
        }
    });
});

// Wait for all operations to complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('\n✅ Database migration complete!');
            console.log('📝 Enhanced workflow features are ready to use.\n');
        }
    });
}, 2000);
