require('dotenv').config();
const { pool } = require('./database');

async function fixSequences() {
  try {
    console.log('🔧 Fixing PostgreSQL sequences...');

    // Fix refresh_tokens sequence
    await pool.query(`
      SELECT setval('refresh_tokens_id_seq',
        (SELECT COALESCE(MAX(id), 0) + 1 FROM refresh_tokens), false);
    `);
    console.log('✅ Fixed refresh_tokens sequence');

    // Fix other sequences that might have the same issue
    const tables = ['users', 'vendors', 'departments', 'approvals', 'fx_rates'];

    for (const table of tables) {
      try {
        await pool.query(`
          SELECT setval('${table}_id_seq',
            (SELECT COALESCE(MAX(id), 0) + 1 FROM ${table}), false);
        `);
        console.log(`✅ Fixed ${table} sequence`);
      } catch (err) {
        console.log(`ℹ️  ${table} sequence doesn't exist or not needed`);
      }
    }

    console.log('✅ All sequences fixed!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing sequences:', err.message);
    await pool.end();
    process.exit(1);
  }
}

fixSequences();
