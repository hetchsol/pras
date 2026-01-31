require('dotenv').config();
const { pool } = require('./database');

async function listUsers() {
  try {
    console.log('🔍 Users in PostgreSQL database:\n');

    const result = await pool.query('SELECT id, username, full_name, role, department FROM users ORDER BY id LIMIT 10');

    result.rows.forEach(u => {
      console.log(`   ${String(u.id).padStart(3)}. ${u.username.padEnd(25)} - ${u.full_name.padEnd(30)} [${u.role.padEnd(15)}]`);
    });

    const total = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n   Total: ${total.rows[0].count} users`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

listUsers();
