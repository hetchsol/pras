require('dotenv').config();
const { pool } = require('./database');

async function checkSchema() {
  try {
    console.log('🔍 Checking users table schema...\n');

    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('Columns in users table:');
    result.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // Now check if there are any users
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`Total users: ${userCount.rows[0].count}\n`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkSchema();
