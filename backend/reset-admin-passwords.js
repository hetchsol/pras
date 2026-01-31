require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function resetPasswords() {
  try {
    console.log('🔐 Resetting admin passwords...\n');

    // Hash the new password
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Reset password for admin user
    await pool.query(
      `UPDATE users SET password = $1 WHERE username = $2`,
      [hashedPassword, 'hetch.mbunda']
    );
    console.log('✅ Reset password for: hetch.mbunda (admin)');

    // Reset password for MD user
    await pool.query(
      `UPDATE users SET password = $1 WHERE username = $2`,
      [hashedPassword, 'kanyembo.ndhlovu']
    );
    console.log('✅ Reset password for: kanyembo.ndhlovu (md)');

    // Reset password for ALL users to password123 for easier access
    console.log('\n🔄 Resetting passwords for ALL users...');
    await pool.query(
      `UPDATE users SET password = $1`,
      [hashedPassword]
    );

    const count = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Reset passwords for all ${count.rows[0].count} users\n`);

    console.log('📝 You can now log in with:');
    console.log('   Username: hetch.mbunda (admin)');
    console.log('   Username: kanyembo.ndhlovu (md)');
    console.log('   Username: (any other username)');
    console.log('   Password: password123\n');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

resetPasswords();
