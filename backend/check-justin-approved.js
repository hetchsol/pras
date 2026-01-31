const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n=== CHECKING JUSTIN/JUSTINE KALUYA APPROVED FORMS ===\n');

// 1. Get Justin's user records
console.log('1️⃣ JUSTIN/JUSTINE USER RECORDS:');
console.log('─'.repeat(60));
const justinUsers = db.prepare(`
    SELECT id, full_name, username, role, department
    FROM users
    WHERE full_name LIKE '%Justin%' OR full_name LIKE '%Justine%' OR username LIKE '%justin%' OR username LIKE '%justine%'
`).all();

justinUsers.forEach(user => {
    console.log('   ID:', user.id);
    console.log('   Full Name:', user.full_name);
    console.log('   Username:', user.username);
    console.log('   Role:', user.role);
    console.log('   Department:', user.department);
    console.log('');
});

// 2. Check all approved petty cash
console.log('2️⃣ APPROVED PETTY CASH REQUISITIONS:');
console.log('─'.repeat(60));
const approvedPettyCash = db.prepare(`
    SELECT id, payee_name, amount, purpose, status, initiator_id, initiator_name, created_at
    FROM petty_cash_requisitions
    WHERE status = 'approved'
    ORDER BY created_at DESC
`).all();

if (approvedPettyCash.length === 0) {
    console.log('   ❌ NO APPROVED PETTY CASH FOUND!\n');
} else {
    approvedPettyCash.forEach(pc => {
        console.log('   ID:', pc.id);
        console.log('   Payee:', pc.payee_name);
        console.log('   Amount:', pc.amount);
        console.log('   Purpose:', pc.purpose);
        console.log('   Status:', pc.status);
        console.log('   Initiator ID:', pc.initiator_id);
        console.log('   Initiator Name:', pc.initiator_name);
        console.log('   Created:', pc.created_at);
        console.log('');
    });
}

// 3. Check all approved EFT requisitions
console.log('3️⃣ APPROVED EFT REQUISITIONS:');
console.log('─'.repeat(60));
const approvedEFT = db.prepare(`
    SELECT id, in_favour_of, amount, purpose, status, initiator_id, initiator_name, created_at
    FROM eft_requisitions
    WHERE status = 'approved'
    ORDER BY created_at DESC
`).all();

if (approvedEFT.length === 0) {
    console.log('   No approved EFT requisitions\n');
} else {
    approvedEFT.forEach(eft => {
        console.log('   ID:', eft.id);
        console.log('   In Favour Of:', eft.in_favour_of);
        console.log('   Amount:', eft.amount);
        console.log('   Status:', eft.status);
        console.log('   Initiator ID:', eft.initiator_id);
        console.log('   Initiator Name:', eft.initiator_name);
        console.log('');
    });
}

// 4. Check all approved expense claims
console.log('4️⃣ APPROVED EXPENSE CLAIMS:');
console.log('─'.repeat(60));
const approvedExpense = db.prepare(`
    SELECT id, employee_name, employee_number, total_claim, status, initiator_id, created_at
    FROM expense_claims
    WHERE status = 'approved'
    ORDER BY created_at DESC
`).all();

if (approvedExpense.length === 0) {
    console.log('   No approved expense claims\n');
} else {
    approvedExpense.forEach(exp => {
        console.log('   ID:', exp.id);
        console.log('   Employee:', exp.employee_name);
        console.log('   Employee Number:', exp.employee_number);
        console.log('   Total Claim:', exp.total_claim);
        console.log('   Status:', exp.status);
        console.log('   Initiator ID:', exp.initiator_id);
        console.log('');
    });
}

// 5. Check all approved purchase requisitions
console.log('5️⃣ APPROVED PURCHASE REQUISITIONS:');
console.log('─'.repeat(60));
const approvedPR = db.prepare(`
    SELECT id, description, amount, status, initiator_id, initiator_name, created_at
    FROM requisitions
    WHERE status = 'approved'
    ORDER BY created_at DESC
`).all();

if (approvedPR.length === 0) {
    console.log('   No approved purchase requisitions\n');
} else {
    approvedPR.forEach(pr => {
        console.log('   ID:', pr.id);
        console.log('   Description:', pr.description);
        console.log('   Amount:', pr.amount);
        console.log('   Status:', pr.status);
        console.log('   Initiator ID:', pr.initiator_id);
        console.log('   Initiator Name:', pr.initiator_name);
        console.log('');
    });
}

// 6. Summary for Justin's approved forms
console.log('6️⃣ SUMMARY - JUSTIN\'S APPROVED FORMS:');
console.log('─'.repeat(60));
justinUsers.forEach(user => {
    console.log(`\n   User: ${user.full_name} (ID: ${user.id})\n`);

    const userPettyCash = approvedPettyCash.filter(pc => pc.initiator_id === user.id);
    const userEFT = approvedEFT.filter(eft => eft.initiator_id === user.id);
    const userExpense = approvedExpense.filter(exp => exp.initiator_id === user.id);
    const userPR = approvedPR.filter(pr => pr.initiator_id === user.id);

    console.log(`   Approved Petty Cash: ${userPettyCash.length}`);
    console.log(`   Approved EFT: ${userEFT.length}`);
    console.log(`   Approved Expense Claims: ${userExpense.length}`);
    console.log(`   Approved Purchase Requisitions: ${userPR.length}`);
    console.log(`   TOTAL: ${userPettyCash.length + userEFT.length + userExpense.length + userPR.length}`);
});

db.close();
console.log('\n✅ Check complete!\n');
