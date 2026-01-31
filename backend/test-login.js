require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function testLogin(username, password) {
  try {
    console.log(`\n🔐 Testing login for: ${username}`);
    console.log('   Password: ' + '*'.repeat(password.length));

    // Get user
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      console.log('   ❌ User not found!\n');
      return false;
    }

    const user = result.rows[0];
    console.log(`   ✅ User found: ${user.full_name || user.name} [${user.role}]`);

    // Test password
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      console.log('   ✅ Password matches!\n');
      console.log('   👉 Login should work with these credentials.');
      return true;
    } else {
      console.log('   ❌ Password does NOT match!\n');
      console.log('   The password hash in database might be different.');
      return false;
    }
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing login credentials...');

  await testLogin('hetch.mbunda', 'password123');
  await testLogin('kanyembo.ndhlovu', 'password123');

  await pool.end();
  process.exit(0);
}

main();
