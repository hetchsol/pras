const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS: APPROVAL STATUSES ACROSS ALL FORMS');
console.log('='.repeat(80) + '\n');

// Check EFT Requisitions
console.log('📋 EFT REQUISITIONS - Status Distribution:\n');
const eftStatuses = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM eft_requisitions
    GROUP BY status
`).all();

eftStatuses.forEach(s => {
    console.log(`   ${s.status}: ${s.count}`);
});
console.log('');

// Sample EFTs with different statuses
console.log('   Sample EFTs:');
const sampleEFTs = db.prepare('SELECT id, in_favour_of, status, initiator_name FROM eft_requisitions LIMIT 5').all();
sampleEFTs.forEach(e => {
    console.log(`   - ${e.id} (${e.initiator_name}) - Status: ${e.status}`);
});
console.log('\n');

// Check Petty Cash
console.log('📋 PETTY CASH - Status Distribution:\n');
const pcStatuses = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM petty_cash_requisitions
    GROUP BY status
`).all();

pcStatuses.forEach(s => {
    console.log(`   ${s.status}: ${s.count}`);
});
console.log('');

// Sample Petty Cash
console.log('   Sample Petty Cash:');
const samplePC = db.prepare('SELECT id, payee_name, status, initiator_name FROM petty_cash_requisitions LIMIT 5').all();
samplePC.forEach(p => {
    console.log(`   - ${p.id} (${p.initiator_name}) - Status: ${p.status}`);
});
console.log('\n');

// Check Expense Claims
console.log('📋 EXPENSE CLAIMS - Status Distribution:\n');
const expStatuses = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM expense_claims
    GROUP BY status
`).all();

expStatuses.forEach(s => {
    console.log(`   ${s.status}: ${s.count}`);
});
console.log('');

// Sample Expense Claims
console.log('   Sample Expense Claims:');
const sampleExp = db.prepare('SELECT id, employee_name, status FROM expense_claims LIMIT 5').all();
sampleExp.forEach(e => {
    console.log(`   - ${e.id} (${e.employee_name}) - Status: ${e.status}`);
});
console.log('\n');

// Check Purchase Requisitions
console.log('📋 PURCHASE REQUISITIONS - Status Distribution:\n');
const prStatuses = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM requisitions
    GROUP BY status
`).all();

prStatuses.forEach(s => {
    console.log(`   ${s.status}: ${s.count}`);
});
console.log('\n');

console.log('='.repeat(80));
console.log('🔍 ISSUE ANALYSIS:');
console.log('='.repeat(80));
console.log('');
console.log('The problem is likely that forms have statuses like:');
console.log('  - "finance_approved" (after Finance approves)');
console.log('  - "hod_approved" (after HOD approves)');
console.log('  - "md_approved" (after MD approves)');
console.log('');
console.log('But initiators can only see status = "approved"');
console.log('');
console.log('SOLUTION: Update frontend to show forms with ANY approval status:');
console.log('  - finance_approved');
console.log('  - hod_approved');
console.log('  - md_approved');
console.log('  - approved');
console.log('  - completed');
console.log('');

db.close();
