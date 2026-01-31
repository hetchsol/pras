const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

console.log('Migrating expense_claim_items table to travel expense schema');
console.log('===========================================================\n');

// Check if table exists and get its structure
const tableInfo = db.prepare('PRAGMA table_info(expense_claim_items)').all();
console.log('Current table structure:');
console.log(tableInfo.map(col => `  ${col.name}: ${col.type}`).join('\n'));

// Check if we need to migrate
const hasReportNo = tableInfo.some(col => col.name === 'report_no');

if (hasReportNo) {
  console.log('\n✅ Table already has the correct schema (report_no exists)');
  db.close();
  process.exit(0);
}

console.log('\n🔄 Migrating to new schema...');

// Backup existing data
const existingItems = db.prepare('SELECT * FROM expense_claim_items').all();
console.log(`\n📦 Found ${existingItems.length} existing items to migrate`);

// Drop the old table
db.prepare('DROP TABLE IF EXISTS expense_claim_items_old').run();
db.prepare('ALTER TABLE expense_claim_items RENAME TO expense_claim_items_old').run();
console.log('✅ Backed up old table');

// Create new table with correct schema
db.prepare(`
  CREATE TABLE expense_claim_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id TEXT NOT NULL,
    report_no INTEGER NOT NULL,
    date TEXT NOT NULL,
    details TEXT NOT NULL,
    km REAL DEFAULT 0,
    breakfast INTEGER DEFAULT 0,
    lunch INTEGER DEFAULT 0,
    dinner INTEGER DEFAULT 0,
    meals REAL DEFAULT 0,
    accommodation REAL DEFAULT 0,
    sundries_phone REAL DEFAULT 0,
    total_zmw REAL DEFAULT 0,
    FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE
  )
`).run();
console.log('✅ Created new table with correct schema');

// Migrate data if any exists
if (existingItems.length > 0) {
  console.log('\n🔄 Migrating existing data...');

  const insertStmt = db.prepare(`
    INSERT INTO expense_claim_items (claim_id, report_no, date, details, km, breakfast, lunch, dinner,
                                     meals, accommodation, sundries_phone, total_zmw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of existingItems) {
    try {
      // Map old schema to new schema
      insertStmt.run(
        item.claim_id,
        item.id || 1,  // report_no (use old id as sequence)
        item.date,
        item.description || '',  // details
        0,  // km
        0,  // breakfast
        0,  // lunch
        0,  // dinner
        0,  // meals
        0,  // accommodation
        0,  // sundries_phone
        item.amount || 0  // total_zmw
      );
      console.log(`  ✅ Migrated item ${item.id} for claim ${item.claim_id}`);
    } catch (error) {
      console.error(`  ❌ Error migrating item ${item.id}:`, error.message);
    }
  }
}

// Verify migration
const newCount = db.prepare('SELECT COUNT(*) as count FROM expense_claim_items').get();
console.log(`\n✅ Migration complete! ${newCount.count} items in new table`);
console.log('\n⚠️  Old table preserved as expense_claim_items_old');
console.log('   You can drop it manually if everything works correctly:');
console.log('   DROP TABLE expense_claim_items_old;');

db.close();
console.log('\n🎉 Migration successful!');
