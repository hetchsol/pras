/**
 * Migration Script: Add assigned_hod column to users table
 * This allows tracking which HOD each user reports to
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Checking if assigned_hod column exists in users table...');

  db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking table structure:', err);
      process.exit(1);
    }

    const hasColumn = columns.some(col => col.name === 'assigned_hod');

    if (hasColumn) {
      console.log('✅ Column assigned_hod already exists in users table');
      db.close();
      process.exit(0);
    } else {
      console.log('➕ Adding assigned_hod column to users table...');

      db.run(`ALTER TABLE users ADD COLUMN assigned_hod INTEGER`, (err) => {
        if (err) {
          console.error('❌ Error adding column:', err);
          process.exit(1);
        }

        console.log('✅ Successfully added assigned_hod column to users table');
        db.close();
        process.exit(0);
      });
    }
  });
});
