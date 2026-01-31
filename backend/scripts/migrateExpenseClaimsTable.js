const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

console.log('Migrating expense_claims table to travel expense claim schema');
console.log('=============================================================\n');

// Check if table exists and get its structure
const tableInfo = db.prepare('PRAGMA table_info(expense_claims)').all();
console.log('Current table structure:');
console.log(tableInfo.map(col => `  ${col.name}: ${col.type}`).join('\n'));

// Check if we need to migrate
const hasEmployeeName = tableInfo.some(col => col.name === 'employee_name');

if (hasEmployeeName) {
  console.log('\n✅ Table already has the correct schema (employee_name exists)');
  db.close();
  process.exit(0);
}

console.log('\n🔄 Migrating to new schema...');

// Backup existing data
const existingClaims = db.prepare('SELECT * FROM expense_claims').all();
console.log(`\n📦 Found ${existingClaims.length} existing claims to migrate`);

// Drop the old table
db.prepare('DROP TABLE IF EXISTS expense_claims_old').run();
db.prepare('ALTER TABLE expense_claims RENAME TO expense_claims_old').run();
console.log('✅ Backed up old table');

// Create new table with correct schema
db.prepare(`
  CREATE TABLE expense_claims (
    id TEXT PRIMARY KEY,
    employee_name TEXT NOT NULL,
    employee_number TEXT NOT NULL,
    department TEXT NOT NULL,
    reason_for_trip TEXT NOT NULL,
    total_kilometers REAL DEFAULT 0,
    km_rate REAL DEFAULT 0,
    sub_total REAL DEFAULT 0,
    total_travel REAL DEFAULT 0,
    total_claim REAL DEFAULT 0,
    amount_advanced REAL DEFAULT 0,
    amount_due REAL DEFAULT 0,
    initiator_id INTEGER NOT NULL,
    initiator_name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initiator_id) REFERENCES users(id)
  )
`).run();
console.log('✅ Created new table with correct schema');

// Migrate data if any exists
if (existingClaims.length > 0) {
  console.log('\n🔄 Migrating existing data...');

  const insertStmt = db.prepare(`
    INSERT INTO expense_claims (id, employee_name, employee_number, department, reason_for_trip,
                                total_kilometers, km_rate, sub_total, total_travel, total_claim,
                                amount_advanced, amount_due, initiator_id, initiator_name, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const claim of existingClaims) {
    try {
      // Map old schema to new schema
      insertStmt.run(
        claim.id,
        claim.claimant_name || 'Unknown',  // employee_name
        '',  // employee_number (empty for old records)
        claim.department,
        `Period: ${claim.period_from} to ${claim.period_to}`,  // reason_for_trip
        0,  // total_kilometers
        0,  // km_rate
        0,  // sub_total
        0,  // total_travel
        claim.total_amount || 0,  // total_claim
        0,  // amount_advanced
        claim.total_amount || 0,  // amount_due
        claim.initiator_id,
        claim.initiator_name,
        claim.status,
        claim.created_at
      );
      console.log(`  ✅ Migrated claim ${claim.id}`);
    } catch (error) {
      console.error(`  ❌ Error migrating claim ${claim.id}:`, error.message);
    }
  }
}

// Verify migration
const newCount = db.prepare('SELECT COUNT(*) as count FROM expense_claims').get();
console.log(`\n✅ Migration complete! ${newCount.count} claims in new table`);
console.log('\n⚠️  Old table preserved as expense_claims_old');
console.log('   You can drop it manually if everything works correctly:');
console.log('   DROP TABLE expense_claims_old;');

db.close();
console.log('\n🎉 Migration successful!');
