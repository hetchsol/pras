/**
 * Fix refresh_tokens table to include ip_address and user_agent columns
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Fixing refresh_tokens table...\n');

db.serialize(() => {
    // Check current structure
    db.all('PRAGMA table_info(refresh_tokens)', (err, cols) => {
        if (err) {
            console.error('Error checking table:', err);
            return;
        }

        console.log('Current columns:', cols.map(c => c.name).join(', '));

        const hasIP = cols.some(c => c.name === 'ip_address');
        const hasUA = cols.some(c => c.name === 'user_agent');

        if (!hasIP || !hasUA) {
            console.log('Missing columns detected. Recreating table...\n');

            // Drop and recreate
            db.run('DROP TABLE IF EXISTS refresh_tokens', (err) => {
                if (err) {
                    console.error('Error dropping table:', err);
                    return;
                }

                console.log('✅ Old table dropped');

                // Create new table with all columns
                db.run(`
                    CREATE TABLE refresh_tokens (
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
                        console.error('Error creating table:', err);
                        return;
                    }

                    console.log('✅ New table created with all columns');

                    // Create indexes
                    db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
                    db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)');

                    console.log('✅ Indexes created');
                    console.log('\n✅ Table fixed successfully!\n');

                    db.close();
                });
            });
        } else {
            console.log('✅ Table already has all required columns\n');
            db.close();
        }
    });
});
