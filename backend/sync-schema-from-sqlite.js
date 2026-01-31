require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const sqliteDb = new sqlite3.Database('./purchase_requisition.db');

async function syncSchema() {
  try {
    console.log('🔄 Syncing PostgreSQL schema from SQLite...\n');

    // Drop all tables in PostgreSQL
    console.log('Dropping all PostgreSQL tables...');
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    console.log('✅ All tables dropped\n');

    // Get all table schemas from SQLite
    sqliteDb.all(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      async (err, tables) => {
        if (err) {
          console.error('❌ Error reading SQLite schema:', err);
          process.exit(1);
        }

        console.log(`Found ${tables.length} tables in SQLite\n`);

        // Convert SQLite schema to PostgreSQL
        for (const table of tables) {
          let pgSql = table.sql;

          // Convert SQLite types to PostgreSQL types
          pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
          pgSql = pgSql.replace(/AUTOINCREMENT/g, '');
          pgSql = pgSql.replace(/DATETIME/g, 'TIMESTAMP');
          pgSql = pgSql.replace(/BOOLEAN/g, 'BOOLEAN');
          pgSql = pgSql.replace(/\bREAL\b/g, 'REAL');
          pgSql = pgSql.replace(/\bDATE\b/g, 'DATE');
          pgSql = pgSql.replace(/\bTEXT\b/g, 'TEXT');

          // Fix INTEGER to INT for non-primary keys to maintain compatibility
          // But keep SERIAL for primary keys
          pgSql = pgSql.replace(/\bINTEGER\b/g, 'INTEGER');

          try {
            await pool.query(pgSql);
            console.log(`✅ Created table: ${table.name}`);
          } catch (error) {
            console.error(`❌ Error creating table ${table.name}:`, error.message);
          }
        }

        console.log('\n🎉 Schema sync complete!\n');

        // Now copy data from SQLite to PostgreSQL
        console.log('📦 Copying data from SQLite to PostgreSQL...\n');
        await copyData(tables);
      }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function copyData(tables) {
  for (const table of tables) {
    const tableName = table.name;

    // Get all rows from SQLite
    sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
      if (err) {
        console.error(`❌ Error reading data from ${tableName}:`, err.message);
        return;
      }

      if (rows.length === 0) {
        console.log(`⏭️  Skipping ${tableName} (empty)`);
        return;
      }

      console.log(`📋 Copying ${rows.length} rows to ${tableName}...`);

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.join(', ');

        try {
          await pool.query(
            `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
            values
          );
        } catch (error) {
          // Skip errors for foreign key violations during initial data load
          if (error.code !== '23503') {
            console.error(`  ❌ Error inserting into ${tableName}:`, error.message);
          }
        }
      }

      console.log(`✅ Copied data to ${tableName}\n`);

      // Check if this was the last table
      if (tableName === tables[tables.length - 1].name) {
        console.log('🎉 Data copy complete!\n');
        sqliteDb.close();
        await pool.end();
        process.exit(0);
      }
    });
  }
}

syncSchema();
