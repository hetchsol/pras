const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

db.all('PRAGMA table_info(users)', (err, cols) => {
  if(err) {
    console.error('Error:', err);
  } else {
    const hasAssignedHod = cols.find(c => c.name === 'assigned_hod');
    console.log('assigned_hod column exists:', !!hasAssignedHod);
    console.log('\nAll columns in users table:');
    cols.forEach(c => console.log(`  - ${c.name} (${c.type})`));
  }
  db.close();
});
