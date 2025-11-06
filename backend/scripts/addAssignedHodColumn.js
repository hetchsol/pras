/**
 * Migration Script: Add assigned_hod_id column to requisitions table
 *
 * This allows procurement to select a specific HOD when initiating requisitions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Checking if assigned_hod_id column exists...');

  db.all("PRAGMA table_info(requisitions)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking table structure:', err);
      process.exit(1);
    }

    const hasColumn = columns.some(col => col.name === 'assigned_hod_id');

    if (hasColumn) {
      console.log('✅ Column assigned_hod_id already exists');
      db.close();
      process.exit(0);
    } else {
      console.log('➕ Adding assigned_hod_id column...');

      db.run(`ALTER TABLE requisitions ADD COLUMN assigned_hod_id INTEGER`, (err) => {
        if (err) {
          console.error('❌ Error adding column:', err);
          process.exit(1);
        }

        console.log('✅ Successfully added assigned_hod_id column to requisitions table');
        db.close();
        process.exit(0);
      });
    }
  });
});
