const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

// Test data
const testUser = {
  username: 'test.user.delete.me',
  full_name: 'Test User',
  email: 'test@example.com',
  password: 'test123',
  role: 'initiator',
  department: 'IT',
  assigned_hod: 13 // Anne Banda's ID
};

console.log('Testing user creation with data:', testUser);
console.log('\n--- Step 1: Check if username exists ---');

db.get(`SELECT id FROM users WHERE username = ?`, [testUser.username], (err, existing) => {
  if (err) {
    console.error('Error checking username:', err);
    db.close();
    return;
  }

  if (existing) {
    console.log('Username exists, deleting first...');
    db.run(`DELETE FROM users WHERE username = ?`, [testUser.username], (err) => {
      if (err) console.error('Delete error:', err);
      else console.log('Deleted existing user');
      attemptCreate();
    });
  } else {
    console.log('Username does not exist, proceeding with creation');
    attemptCreate();
  }
});

function attemptCreate() {
  console.log('\n--- Step 2: Hash password ---');
  const hashedPassword = bcrypt.hashSync(testUser.password, 10);
  console.log('Password hashed successfully');

  console.log('\n--- Step 3: Insert into database ---');
  console.log('SQL: INSERT INTO users (username, full_name, email, password, role, department, assigned_hod) VALUES (?, ?, ?, ?, ?, ?, ?)');
  console.log('Params:', [testUser.username, testUser.full_name, testUser.email, '***', testUser.role, testUser.department, testUser.assigned_hod]);

  db.run(`
    INSERT INTO users (username, full_name, email, password, role, department, assigned_hod)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [testUser.username, testUser.full_name, testUser.email, hashedPassword, testUser.role, testUser.department, testUser.assigned_hod], function(err) {
    if (err) {
      console.error('\n❌ ERROR creating user:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
    } else {
      console.log('\n✅ SUCCESS! User created with ID:', this.lastID);

      // Verify
      db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (err, user) => {
        if (err) {
          console.error('Error verifying:', err);
        } else {
          console.log('\nCreated user:', {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            department: user.department,
            assigned_hod: user.assigned_hod
          });
        }
        db.close();
      });
    }
  });
}
