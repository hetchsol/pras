/**
 * Database Migration Script: Add Refresh Tokens Table
 *
 * This script creates a table to store refresh tokens for users.
 * Refresh tokens allow users to obtain new access tokens without re-authenticating.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding refresh tokens table...\n');

db.serialize(() => {
    // Create refresh_tokens table
    db.run(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            revoked BOOLEAN DEFAULT 0,
            revoked_at DATETIME,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creating refresh_tokens table:', err.message);
        } else {
            console.log('✅ refresh_tokens table created successfully');
        }
    });

    // Create index for faster lookups
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
        ON refresh_tokens(user_id)
    `, (err) => {
        if (err) {
            console.error('❌ Error creating index:', err.message);
        } else {
            console.log('✅ Index on user_id created successfully');
        }
    });

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token
        ON refresh_tokens(token)
    `, (err) => {
        if (err) {
            console.error('❌ Error creating index:', err.message);
        } else {
            console.log('✅ Index on token created successfully');
        }
    });
});

// Close database connection
db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err.message);
    } else {
        console.log('\n✅ Database migration complete!');
        console.log('📝 Refresh tokens table is ready to use.\n');
    }
});
