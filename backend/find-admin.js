require('dotenv').config();
const { pool } = require('./database');

async function findAdmin() {
  try {
    console.log('🔍 Looking for admin and MD users:\n');

    const result = await pool.query(`
      SELECT id, username, full_name, role, department
      FROM users
      WHERE role IN ('admin', 'md', 'finance_manager')
      ORDER BY role, id
    `);

    if (result.rows.length === 0) {
      console.log('❌ No admin, MD, or finance_manager users found!');
    } else {
      console.log('Administrative users:');
      result.rows.forEach(u => {
        console.log(`   ${String(u.id).padStart(3)}. ${u.username.padEnd(25)} - ${u.full_name.padEnd(30)} [${u.role}]`);
      });
    }

    console.log('\n💡 Use these credentials to log in:');
    console.log('   Username: (one of the usernames above)');
    console.log('   Password: password123\n');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

findAdmin();
