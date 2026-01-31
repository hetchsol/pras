const Database = require('better-sqlite3');
const path = require('path');
const jwt = require('jsonwebtoken');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

console.log('\n=== SIMULATING JUSTIN LOGIN ===\n');

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

// 2. Simulate JWT token (what would be in localStorage)
const userForToken = {
    id: justin.id,
    username: justin.username,
    name: justin.full_name,
    role: justin.role,
    department: justin.department
};

console.log('2️⃣ JWT TOKEN PAYLOAD:');
console.log('   ', JSON.stringify(userForToken, null, 2));
console.log('');

// 3. Check petty cash requisitions
console.log('3️⃣ PETTY CASH REQUISITIONS:');
const { getPettyCashRequisitions } = require('./database');
const allPettyCash = getPettyCashRequisitions();

console.log('   Total in database:', allPettyCash.length);

// Filter as backend would for initiator
const justinPettyCash = allPettyCash.filter(r => r.initiator_id === justin.id);
console.log('   Justin\'s requisitions:', justinPettyCash.length);
console.log('');

if (justinPettyCash.length > 0) {
    justinPettyCash.forEach(pc => {
        console.log('   ✅', pc.id);
        console.log('      Status:', pc.status);
        console.log('      Payee:', pc.payee_name);
        console.log('      Amount:', pc.amount);
        console.log('      Initiator ID:', pc.initiator_id, '(matches:', pc.initiator_id === justin.id, ')');
        console.log('');
    });
}

// 4. Check EFT requisitions
console.log('4️⃣ EFT REQUISITIONS:');
const { getEFTRequisitions } = require('./database');
const allEFT = getEFTRequisitions();
const justinEFT = allEFT.filter(r => r.initiator_id === justin.id);
console.log('   Total in database:', allEFT.length);
console.log('   Justin\'s requisitions:', justinEFT.length);
console.log('');

// 5. Check expense claims
console.log('5️⃣ EXPENSE CLAIMS:');
const { getExpenseClaims } = require('./database');
const allExpense = getExpenseClaims();
const justinExpense = allExpense.filter(c => c.initiator_id === justin.id);
console.log('   Total in database:', allExpense.length);
console.log('   Justin\'s claims:', justinExpense.length);
console.log('');

// 6. Summary
console.log('6️⃣ SUMMARY FOR JUSTIN:');
console.log('─'.repeat(60));
console.log('   Petty Cash:', justinPettyCash.filter(r => r.status === 'approved').length, 'approved');
console.log('   EFT:', justinEFT.filter(r => r.status === 'approved').length, 'approved');
console.log('   Expense Claims:', justinExpense.filter(c => c.status === 'approved').length, 'approved');
console.log('');

db.close();
console.log('✅ Test complete!\n');
