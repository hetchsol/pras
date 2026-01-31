const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n' + '='.repeat(80));
console.log('INVESTIGATION: JUSTIN\'S APPROVED FORMS & ABRAHAM\'S EFT WORKFLOW');
console.log('='.repeat(80) + '\n');

// ===== PART 1: JUSTIN'S APPROVED FORMS =====
console.log('📋 PART 1: JUSTIN\'S APPROVED FORMS\n');

const justin = db.prepare('SELECT * FROM users WHERE username = ?').get('kaluya.justin');

if (!justin) {
    console.log('❌ Justin not found!');
} else {
    console.log('✅ JUSTIN\'S ACCOUNT:');
    console.log('   ID:', justin.id);
    console.log('   Username:', justin.username);
    console.log('   Full Name:', justin.full_name);
    console.log('   Role:', justin.role);
    console.log('   Department:', justin.department);
    console.log('');

    // Check Purchase Requisitions (uses created_by)
    console.log('1️⃣ PURCHASE REQUISITIONS:');
    const prApproved = db.prepare(`
        SELECT id, req_number, description, status, created_by
        FROM requisitions
        WHERE created_by = ? AND status = 'approved'
    `).all(justin.id);
    console.log(`   Total approved: ${prApproved.length}`);
    if (prApproved.length > 0) {
        prApproved.forEach(pr => {
            console.log(`   ✅ ${pr.req_number} - ${pr.description}`);
        });
    }
    console.log('');

    // Check EFT Requisitions
    console.log('2️⃣ EFT REQUISITIONS:');
    const eftApproved = db.prepare(`
        SELECT id, payee_name, amount, purpose, status, initiator_id, initiator_name
        FROM eft_requisitions
        WHERE initiator_id = ? AND status = 'approved'
    `).all(justin.id);
    console.log(`   Total approved: ${eftApproved.length}`);
    if (eftApproved.length > 0) {
        eftApproved.forEach(eft => {
            console.log(`   ✅ ${eft.id} - ${eft.payee_name} - ${eft.amount}`);
        });
    }
    console.log('');

    // Check Petty Cash
    console.log('3️⃣ PETTY CASH:');
    const pcApproved = db.prepare(`
        SELECT id, payee_name, amount, purpose, status, initiator_id, initiator_name
        FROM petty_cash_requisitions
        WHERE initiator_id = ? AND status = 'approved'
    `).all(justin.id);
    console.log(`   Total approved: ${pcApproved.length}`);
    if (pcApproved.length > 0) {
        pcApproved.forEach(pc => {
            console.log(`   ✅ ${pc.id} - ${pc.payee_name} - ${pc.amount}`);
        });
    }
    console.log('');

    // Check Expense Claims
    console.log('4️⃣ EXPENSE CLAIMS:');
    const expApproved = db.prepare(`
        SELECT id, employee_name, total_claim, status, initiator_id
        FROM expense_claims
        WHERE initiator_id = ? AND status = 'approved'
    `).all(justin.id);
    console.log(`   Total approved: ${expApproved.length}`);
    if (expApproved.length > 0) {
        expApproved.forEach(exp => {
            console.log(`   ✅ ${exp.id} - ${exp.employee_name} - ${exp.total_claim}`);
        });
    }
    console.log('');

    console.log('📊 SUMMARY FOR JUSTIN:');
    console.log('─'.repeat(60));
    console.log(`   Purchase Requisitions: ${prApproved.length}`);
    console.log(`   EFT Requisitions: ${eftApproved.length}`);
    console.log(`   Petty Cash: ${pcApproved.length}`);
    console.log(`   Expense Claims: ${expApproved.length}`);
    console.log(`   TOTAL APPROVED: ${prApproved.length + eftApproved.length + pcApproved.length + expApproved.length}`);
    console.log('');
}

// ===== PART 2: ABRAHAM MUBANGA'S EFT WORKFLOW =====
console.log('\n' + '='.repeat(80));
console.log('📋 PART 2: ABRAHAM MUBANGA\'S EFT WORKFLOW\n');

const abraham = db.prepare('SELECT * FROM users WHERE full_name LIKE ?').get('%Abraham%Mubanga%');

if (!abraham) {
    console.log('❌ Abraham Mubanga not found!');
    console.log('   Searching all users with "Mubanga":');
    const mubangaUsers = db.prepare('SELECT id, username, full_name, role, department FROM users WHERE full_name LIKE ?').all('%Mubanga%');
    mubangaUsers.forEach(u => {
        console.log(`   - ID: ${u.id}, Name: ${u.full_name}, Username: ${u.username}, Role: ${u.role}, Dept: ${u.department}`);
    });
} else {
    console.log('✅ ABRAHAM\'S ACCOUNT:');
    console.log('   ID:', abraham.id);
    console.log('   Username:', abraham.username);
    console.log('   Full Name:', abraham.full_name);
    console.log('   Role:', abraham.role);
    console.log('   Department:', abraham.department);
    console.log('');

    // Get Abraham's EFT requisitions
    console.log('🔍 ABRAHAM\'S EFT REQUISITIONS:');
    const abrahamEFTs = db.prepare(`
        SELECT id, payee_name, amount, purpose, status, initiator_id, initiator_name, created_at
        FROM eft_requisitions
        WHERE initiator_id = ?
        ORDER BY created_at DESC
    `).all(abraham.id);

    console.log(`   Total EFTs: ${abrahamEFTs.length}`);
    console.log('');

    if (abrahamEFTs.length === 0) {
        console.log('   ⚠️  No EFT requisitions found for Abraham');
    } else {
        abrahamEFTs.forEach((eft, index) => {
            console.log(`   ${index + 1}. EFT ID: ${eft.id}`);
            console.log(`      Payee: ${eft.payee_name}`);
            console.log(`      Amount: ${eft.amount}`);
            console.log(`      Purpose: ${eft.purpose}`);
            console.log(`      Status: ${eft.status}`);
            console.log(`      Initiator: ${eft.initiator_name} (ID: ${eft.initiator_id})`);
            console.log(`      Created: ${eft.created_at}`);

            // Get approval workflow for this EFT
            console.log('      \n      📝 APPROVAL WORKFLOW:');
            const approvals = db.prepare(`
                SELECT approver_id, approver_name, approver_role, action, created_at
                FROM form_approvals
                WHERE form_type = 'eft' AND form_id = ?
                ORDER BY created_at ASC
            `).all(eft.id);

            if (approvals.length === 0) {
                console.log('         ⚠️  No approvals recorded yet');
            } else {
                approvals.forEach((appr, i) => {
                    console.log(`         ${i + 1}. ${appr.approver_role.toUpperCase()}: ${appr.approver_name} - ${appr.action.toUpperCase()} at ${appr.created_at}`);
                });
            }

            // Check who should approve next
            console.log('      \n      🎯 EXPECTED WORKFLOW:');
            console.log('         HOD → Finance (Joe) → MD');

            // Find Joe (Finance role)
            const joe = db.prepare('SELECT id, full_name, role FROM users WHERE role = ?').get('finance');
            if (joe) {
                console.log(`         Finance approver: ${joe.full_name} (ID: ${joe.id})`);
            } else {
                console.log('         ⚠️  No Finance user found!');
            }

            console.log('');
        });
    }
}

// ===== PART 3: CHECK JOE'S ACCOUNT =====
console.log('\n' + '='.repeat(80));
console.log('📋 PART 3: JOE\'S ACCOUNT & PENDING APPROVALS\n');

const joe = db.prepare('SELECT * FROM users WHERE role = ?').get('finance');

if (!joe) {
    console.log('❌ Finance user (Joe) not found!');
    console.log('   All users with finance-related roles:');
    const financeUsers = db.prepare('SELECT id, username, full_name, role FROM users WHERE role LIKE ?').all('%finance%');
    financeUsers.forEach(u => {
        console.log(`   - ${u.full_name} (${u.username}) - Role: ${u.role}`);
    });
} else {
    console.log('✅ JOE\'S ACCOUNT:');
    console.log('   ID:', joe.id);
    console.log('   Username:', joe.username);
    console.log('   Full Name:', joe.full_name);
    console.log('   Role:', joe.role);
    console.log('');

    // Check EFTs pending finance approval
    console.log('📨 EFTs PENDING FINANCE APPROVAL:');
    const pendingEFTs = db.prepare(`
        SELECT id, payee_name, amount, purpose, status, initiator_name
        FROM eft_requisitions
        WHERE status LIKE '%pending_finance%'
        ORDER BY created_at DESC
    `).all();

    console.log(`   Total pending: ${pendingEFTs.length}`);
    if (pendingEFTs.length > 0) {
        pendingEFTs.forEach(eft => {
            console.log(`   ⏳ ${eft.id} - ${eft.payee_name} - ${eft.amount} (Status: ${eft.status})`);
            console.log(`      Initiator: ${eft.initiator_name}`);
        });
    }
}

console.log('\n' + '='.repeat(80));
console.log('✅ Investigation complete!');
console.log('='.repeat(80) + '\n');

db.close();
