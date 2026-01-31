const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding Sales department...');

db.run(`
  INSERT INTO departments (name, code, description, is_active)
  VALUES ('Sales', 'SALES', 'Sales and Business Development Department', 1)
`, function(err) {
  if (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log('✅ Sales department already exists');
    } else {
      console.error('❌ Error adding Sales department:', err);
    }
  } else {
    console.log('✅ Sales department added successfully with ID:', this.lastID);
  }

  // Verify
  db.all(`SELECT * FROM departments ORDER BY name`, (err, departments) => {
    if (err) {
      console.error('Error fetching departments:', err);
    } else {
      console.log('\nAll departments:');
      departments.forEach(dept => {
        console.log(`  - ${dept.name} (${dept.code}): ${dept.description || 'No description'}`);
      });
    }
    db.close();
  });
});
