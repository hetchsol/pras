const Database = require('better-sqlite3');
const path = require('path');
const jwt = require('jsonwebtoken');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

console.log('\n=== TESTING JUSTIN\'S APPROVED FORMS ACCESS ===\n');

// 1. Get Justin's user record
const justin = db.prepare('SELECT * FROM users WHERE username = ?').get('kaluya.justin');

if (!justin) {
    console.log('❌ Justin not found!');
    process.exit(1);
}

console.log('1️⃣ JUSTIN\'S USER RECORD:');
console.log('   ID:', justin.id);
console.log('   Username:', justin.username);
console.log('   Full Name:', justin.full_name);
console.log('   Role:', justin.role);
console.log('   Department:', justin.department);
console.log('');

// 2. Check APPROVED petty cash requisitions
console.log('2️⃣ APPROVED PETTY CASH FOR JUSTIN:');
const approvedPettyCash = db.prepare(`
    SELECT id, payee_name, amount, purpose, status, initiator_id, initiator_name, created_at
    FROM petty_cash_requisitions
    WHERE status = 'approved' AND initiator_id = ?
    ORDER BY created_at DESC
`).all(justin.id);

console.log(`   Total approved petty cash: ${approvedPettyCash.length}`);
if (approvedPettyCash.length > 0) {
    approvedPettyCash.forEach(pc => {
        console.log(`   ✅ ${pc.id}`);
        console.log(`      Payee: ${pc.payee_name}`);
        console.log(`      Amount: ${pc.amount}`);
        console.log(`      Purpose: ${pc.purpose}`);
        console.log(`      Status: ${pc.status}`);
        console.log(`      Initiator ID: ${pc.initiator_id} (matches: ${pc.initiator_id === justin.id})`);
        console.log('');
    });
}
console.log('');

// 3. Simulate what the API would return for initiator
console.log('3️⃣ SIMULATING API RESPONSE FOR INITIATOR:');
const { getPettyCashRequisitions } = require('./database');
const allPettyCash = getPettyCashRequisitions();

console.log(`   Total petty cash in system: ${allPettyCash.length}`);

// Filter as backend would for initiator viewing approved forms
const justinApprovedForms = allPettyCash.filter(r =>
    r.status === 'approved' && r.initiator_id === justin.id
);

console.log(`   Justin's approved forms: ${justinApprovedForms.length}`);
if (justinApprovedForms.length > 0) {
    justinApprovedForms.forEach(form => {
        console.log(`   ✅ ${form.id}`);
        console.log(`      Status: ${form.status}`);
        console.log(`      Payee: ${form.payee_name}`);
        console.log(`      Amount: ${form.amount}`);
        console.log('');
    });
} else {
    console.log('   ❌ NO APPROVED FORMS FOUND FOR JUSTIN!');
}

console.log('');
console.log('4️⃣ SUMMARY:');
console.log('─'.repeat(60));
console.log(`   Justin ID: ${justin.id}`);
console.log(`   Approved Petty Cash (DB): ${approvedPettyCash.length}`);
console.log(`   Approved Forms (API): ${justinApprovedForms.length}`);
console.log('');

if (justinApprovedForms.length > 0) {
    console.log('✅ Justin SHOULD see his approved forms!');
} else {
    console.log('❌ Justin WILL NOT see any approved forms!');
}

db.close();
console.log('\n✅ Test complete!\n');
