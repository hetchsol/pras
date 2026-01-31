const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

console.log('Setting up Regional Expense Claim Approvers');
console.log('============================================');
console.log('NOTE: This is ONLY for Expense Claims');
console.log('EFT Requisitions and Purchase Requisitions continue to use Finance → MD workflow\n');

// Create table for regional expense claim approvers
db.prepare(`
  CREATE TABLE IF NOT EXISTS regional_expense_approvers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    departments TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`).run();

console.log('✅ Table created: regional_expense_approvers');

// Clear existing mappings
db.prepare('DELETE FROM regional_expense_approvers').run();
console.log('✅ Cleared existing mappings');

// Get user IDs
const nashon = db.prepare('SELECT id, username, full_name FROM users WHERE username = ?').get('nashon.nguni');
const mwansa = db.prepare('SELECT id, username, full_name FROM users WHERE username = ?').get('mwelwa.mwansa');

if (!nashon) {
  console.error('❌ User not found: nashon.nguni');
  process.exit(1);
}

if (!mwansa) {
  console.error('❌ User not found: mwelwa.mwansa');
  process.exit(1);
}

console.log('\nFound users:');
console.log(`  Nashon: ID=${nashon.id}, Username=${nashon.username}, Name=${nashon.full_name}`);
console.log(`  Mwansa: ID=${mwansa.id}, Username=${mwansa.username}, Name=${mwansa.full_name}`);

// Insert mappings
// Nashon approves for Kitwe and Solwezi (note: Kitwe might be part of Operations department)
db.prepare(`
  INSERT INTO regional_expense_approvers (user_id, username, full_name, departments)
  VALUES (?, ?, ?, ?)
`).run(nashon.id, nashon.username, nashon.full_name, 'Solwezi,Operations');

console.log('\n✅ Added Nashon Nguni as approver for: Solwezi, Operations (Kitwe)');

// Mwansa approves for Lusaka
db.prepare(`
  INSERT INTO regional_expense_approvers (user_id, username, full_name, departments)
  VALUES (?, ?, ?, ?)
`).run(mwansa.id, mwansa.username, mwansa.full_name, 'Lusaka');

console.log('✅ Added Mwansa Mwelwa as approver for: Lusaka');

// Verify the mappings
console.log('\n=== VERIFICATION ===');
const approvers = db.prepare('SELECT * FROM regional_expense_approvers').all();
approvers.forEach(a => {
  console.log(`\nApprover: ${a.full_name}`);
  console.log(`  User ID: ${a.user_id}`);
  console.log(`  Username: ${a.username}`);
  console.log(`  Departments: ${a.departments}`);
  console.log(`  Created: ${a.created_at}`);
});

console.log('\n✅ Regional expense claim approvers configured successfully!');
console.log('\n=== EXPENSE CLAIM WORKFLOW ===');
console.log('  Solwezi/Operations → Nashon Nguni → MD');
console.log('  Lusaka → Mwansa Mwelwa → MD');
console.log('\n=== OTHER FORMS (EFT, Purchase Requisitions) ===');
console.log('  All departments → Finance Manager → MD');

db.close();
