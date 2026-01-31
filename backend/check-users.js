require('dotenv').config();
const { pool } = require('./database');

async function checkUsers() {
  try {
    console.log('🔍 Checking users in PostgreSQL database...\n');

    const result = await pool.query('SELECT id, username, name, role, department FROM users ORDER BY id');

    if (result.rows.length === 0) {
      console.log('❌ No users found in database!');
      console.log('   The database needs to be initialized.\n');
    } else {
      console.log(`✅ Found ${result.rows.length} users:\n`);
      result.rows.forEach(u => {
        console.log(`   ${u.id}. ${u.username.padEnd(20)} - ${u.name.padEnd(25)} [${u.role}] (${u.department})`);
      });
      console.log('');
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkUsers();
