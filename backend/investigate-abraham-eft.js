const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n' + '='.repeat(80));
console.log('INVESTIGATION: ABRAHAM MUBANGA EFT WORKFLOW');
console.log('='.repeat(80) + '\n');

// Find Abraham
const abraham = db.prepare(`
    SELECT * FROM users
    WHERE full_name LIKE '%Abraham%' OR full_name LIKE '%Mubanga%'
`).all();

console.log('1️⃣ USERS MATCHING "ABRAHAM" OR "MUBANGA":');
abraham.forEach(u => {
    console.log(`   - ID: ${u.id}, Name: ${u.full_name}, Username: ${u.username}, Role: ${u.role}, Dept: ${u.department}`);
});
console.log('');

if (abraham.length === 0) {
    console.log('❌ No user found with Abraham or Mubanga');
    db.close();
    process.exit(0);
}

// Use the first match (should be Abraham Mubanga)
const abrahamUser = abraham.find(u => u.full_name.includes('Mubanga') && u.full_name.includes('Abraham'));

if (!abrahamUser) {
    console.log('❌ Could not find exact match for Abraham Mubanga');
    db.close();
    process.exit(0);
}

console.log('✅ ABRAHAM MUBANGA:');
console.log(`   ID: ${abrahamUser.id}`);
console.log(`   Username: ${abrahamUser.username}`);
console.log(`   Role: ${abrahamUser.role}`);
console.log(`   Department: ${abrahamUser.department}`);
console.log('');

// Get Abraham's EFT requisitions
console.log('2️⃣ ABRAHAM\'S EFT REQUISITIONS:\n');
const abrahamEFTs = db.prepare(`
    SELECT id, in_favour_of, amount, purpose, status, initiator_id, initiator_name, created_at
    FROM eft_requisitions
    WHERE initiator_id = ?
    ORDER BY created_at DESC
`).all(abrahamUser.id);

console.log(`   Total EFTs: ${abrahamEFTs.length}\n`);

if (abrahamEFTs.length === 0) {
    console.log('   ⚠️  No EFT requisitions found for Abraham');
} else {
    abrahamEFTs.forEach((eft, index) => {
        console.log(`   ${index + 1}. EFT ID: ${eft.id}`);
        console.log(`      In Favour Of: ${eft.in_favour_of}`);
        console.log(`      Amount: ${eft.amount}`);
        console.log(`      Purpose: ${eft.purpose || 'N/A'}`);
        console.log(`      Status: ${eft.status}`);
        console.log(`      Created: ${eft.created_at}`);

        // Get approval workflow for this EFT
        console.log('      \n      📝 APPROVAL HISTORY:');
        const approvals = db.prepare(`
            SELECT approver_id, approver_name, approver_role, action, created_at
            FROM form_approvals
            WHERE form_type = 'eft' AND form_id = ?
            ORDER BY created_at ASC
        `).all(eft.id);

        if (approvals.length === 0) {
            console.log('         ⚠️  No approvals recorded');
        } else {
            approvals.forEach((appr, i) => {
                const actionIcon = appr.action === 'approve' ? '✅' : '❌';
                console.log(`         ${i + 1}. ${actionIcon} ${appr.approver_role.toUpperCase()}: ${appr.approver_name} - ${appr.action.toUpperCase()}`);
                console.log(`            Timestamp: ${appr.created_at}`);
            });
        }

        console.log('      \n      🎯 NEXT STEP ANALYSIS:');

        // Determine next approver based on status
        if (eft.status === 'pending_hod' || eft.status === 'draft') {
            // Find HOD
            const hod = db.prepare(`
                SELECT id, full_name, role, department
                FROM users
                WHERE role = 'hod' AND department = ?
            `).get(abrahamUser.department);

            if (hod) {
                console.log(`         ⏭️  Needs HOD approval: ${hod.full_name} (Dept: ${hod.department})`);
            } else {
                console.log(`         ⚠️  No HOD found for department: ${abrahamUser.department}`);
            }
        } else if (eft.status.includes('pending_finance') || eft.status === 'hod_approved') {
            // Find Finance (Joe)
            const joe = db.prepare('SELECT id, full_name, role FROM users WHERE role = ?').get('finance');
            if (joe) {
                console.log(`         ⏭️  Needs Finance approval: ${joe.full_name} (Role: ${joe.role})`);
            } else {
                console.log('         ⚠️  No Finance user (Joe) found!');
            }
        } else if (eft.status.includes('pending_md') || eft.status === 'finance_approved') {
            // Find MD
            const md = db.prepare('SELECT id, full_name, role FROM users WHERE role = ?').get('md');
            if (md) {
                console.log(`         ⏭️  Needs MD approval: ${md.full_name} (Role: ${md.role})`);
            } else {
                console.log('         ⚠️  No MD user found!');
            }
        } else if (eft.status === 'approved' || eft.status === 'md_approved') {
            console.log('         ✅ Fully approved - workflow complete');
        } else {
            console.log(`         ⚠️  Unknown status: ${eft.status}`);
        }

        console.log('');
    });
}

// Check Joe's account
console.log('\n3️⃣ JOE (FINANCE) STATUS:\n');
const joe = db.prepare('SELECT * FROM users WHERE role = ?').get('finance');

if (!joe) {
    console.log('   ❌ No Finance user found!');
    console.log('   Looking for users with "finance" in role:');
    const financeUsers = db.prepare(`
        SELECT id, username, full_name, role
        FROM users
        WHERE role LIKE '%finance%'
    `).all();
    financeUsers.forEach(u => {
        console.log(`   - ${u.full_name} (${u.username}) - Role: ${u.role}`);
    });
} else {
    console.log(`   ✅ Finance User: ${joe.full_name} (ID: ${joe.id})`);
    console.log(`   Username: ${joe.username}`);
    console.log(`   Role: ${joe.role}`);
}

console.log('\n' + '='.repeat(80));
console.log('✅ Investigation complete!');
console.log('='.repeat(80) + '\n');

db.close();
