const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   SETUP REGIONAL APPROVERS WITH DEDICATED ROLE            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

try {
  // 1. Update Nashon Nguni to regional_approver role
  console.log('1. Updating Nashon Nguni (ID: 41) to regional_approver role...');
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run('regional_approver', 41);
  console.log('   ✅ Nashon Nguni updated');

  // 2. Update Mwansa Mwelwa to regional_approver role
  console.log('\n2. Updating Mwansa Mwelwa (ID: 43) to regional_approver role...');
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run('regional_approver', 43);
  console.log('   ✅ Mwansa Mwelwa updated');

  // 3. Verify changes
  console.log('\n3. Verifying changes...');
  const nashon = db.prepare('SELECT id, username, full_name, role, department FROM users WHERE id = 41').get();
  const mwansa = db.prepare('SELECT id, username, full_name, role, department FROM users WHERE id = 43').get();

  console.log('\n   Nashon Nguni:');
  console.log(`     - Username: ${nashon.username}`);
  console.log(`     - Role: ${nashon.role}`);
  console.log(`     - Department: ${nashon.department}`);

  console.log('\n   Mwansa Mwelwa:');
  console.log(`     - Username: ${mwansa.username}`);
  console.log(`     - Role: ${mwansa.role}`);
  console.log(`     - Department: ${mwansa.department}`);

  // 4. Check regional_expense_approvers table
  console.log('\n4. Checking regional_expense_approvers configuration...');
  const approvers = db.prepare('SELECT * FROM regional_expense_approvers').all();
  approvers.forEach(a => {
    console.log(`   ✅ ${a.full_name}: ${a.departments}`);
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    SETUP COMPLETE                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n📝 Summary:');
  console.log('   - Nashon Nguni: regional_approver (Solwezi, Operations)');
  console.log('   - Mwansa Mwelwa: regional_approver (Lusaka)');
  console.log('\n✅ They can now:');
  console.log('   1. Submit their own expense claims');
  console.log('   2. Approve expense claims from their regions');
  console.log('   3. See all claims from their departments\n');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
