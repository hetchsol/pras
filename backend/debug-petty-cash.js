const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n=== DEBUGGING PETTY CASH VISIBILITY ISSUE ===\n');

// 1. Find Justin Kaluya's user record
console.log('1️⃣ JUSTIN KALUYA USER RECORD:');
console.log('─'.repeat(60));
const justin = db.prepare(`
    SELECT id, full_name, username, role, department, assigned_hod
    FROM users
    WHERE full_name LIKE '%Justin%' OR username LIKE '%justin%'
`).all();
justin.forEach(user => {
    console.log('   ID:', user.id);
    console.log('   Full Name:', user.full_name);
    console.log('   Username:', user.username);
    console.log('   Role:', user.role);
    console.log('   Department:', user.department);
    console.log('   Assigned HOD ID:', user.assigned_hod);
    console.log('');
});

// 2. Find Joe Munthali's user record
console.log('2️⃣ JOE MUNTHALI USER RECORD:');
console.log('─'.repeat(60));
const joe = db.prepare(`
    SELECT id, full_name, username, role, department
    FROM users
    WHERE full_name LIKE '%Joe%' OR username LIKE '%joe%'
`).all();
joe.forEach(user => {
    console.log('   ID:', user.id);
    console.log('   Full Name:', user.full_name);
    console.log('   Username:', user.username);
    console.log('   Role:', user.role);
    console.log('   Department:', user.department);
    console.log('');
});

// 3. Find all petty cash requisitions
console.log('3️⃣ ALL PETTY CASH REQUISITIONS:');
console.log('─'.repeat(60));
const pettyCash = db.prepare(`
    SELECT id, payee_name, amount, purpose, department, initiator_id, initiator_name, status, created_at
    FROM petty_cash_requisitions
    ORDER BY created_at DESC
`).all();

if (pettyCash.length === 0) {
    console.log('   ⚠️  NO PETTY CASH REQUISITIONS FOUND!\n');
} else {
    pettyCash.forEach(pc => {
        console.log('   ID:', pc.id);
        console.log('   Payee:', pc.payee_name);
        console.log('   Amount:', pc.amount);
        console.log('   Purpose:', pc.purpose);
        console.log('   Department:', pc.department);
        console.log('   Initiator ID:', pc.initiator_id);
        console.log('   Initiator Name:', pc.initiator_name);
        console.log('   Status:', pc.status);
        console.log('   Created:', pc.created_at);
        console.log('');
    });
}

// 4. Check for petty cash items
console.log('4️⃣ PETTY CASH ITEMS:');
console.log('─'.repeat(60));
const items = db.prepare(`
    SELECT * FROM petty_cash_items
`).all();
if (items.length === 0) {
    console.log('   No items found\n');
} else {
    items.forEach(item => {
        console.log('   Requisition ID:', item.requisition_id);
        console.log('   Item No:', item.item_no);
        console.log('   Description:', item.description);
        console.log('   Amount:', item.amount);
        console.log('');
    });
}

// 5. Simulate the filtering logic for Joe Munthali as HOD
if (joe.length > 0 && pettyCash.length > 0) {
    console.log('5️⃣ SIMULATED FILTERING FOR JOE MUNTHALI (HOD):');
    console.log('─'.repeat(60));
    const joeUser = joe[0];
    const joesDepartment = joeUser.department;

    console.log('   Joe\'s Department:', joesDepartment);
    console.log('   Joe\'s Role:', joeUser.role);
    console.log('   Joe\'s ID:', joeUser.id);
    console.log('');

    const filteredForJoe = pettyCash.filter(r => {
        const isInitiatorMatch = r.initiator_id === joeUser.id;
        const isDepartmentMatch = r.department === joesDepartment;
        const isStatusMatch = r.status === 'pending_hod';

        console.log('   Checking requisition:', r.id);
        console.log('      Initiator ID match:', isInitiatorMatch, `(${r.initiator_id} === ${joeUser.id})`);
        console.log('      Department match:', isDepartmentMatch, `("${r.department}" === "${joesDepartment}")`);
        console.log('      Status match:', isStatusMatch, `("${r.status}" === "pending_hod")`);
        console.log('      Should show:', isInitiatorMatch || (isDepartmentMatch && isStatusMatch));
        console.log('');

        return isInitiatorMatch || (isDepartmentMatch && isStatusMatch);
    });

    console.log('   RESULT: Joe should see', filteredForJoe.length, 'requisition(s)');
    console.log('');
}

// 6. Check if there's a HOD for the department
if (justin.length > 0) {
    console.log('6️⃣ HOD CHECK FOR JUSTIN\'S DEPARTMENT:');
    console.log('─'.repeat(60));
    const justinUser = justin[0];
    const departmentHOD = db.prepare(`
        SELECT id, full_name, username, role, department
        FROM users
        WHERE role = 'hod' AND department = ?
    `).get(justinUser.department);

    if (departmentHOD) {
        console.log('   ✅ HOD found for', justinUser.department);
        console.log('   HOD Name:', departmentHOD.full_name);
        console.log('   HOD Username:', departmentHOD.username);
        console.log('   HOD ID:', departmentHOD.id);
    } else {
        console.log('   ❌ NO HOD found for', justinUser.department);
    }
    console.log('');
}

db.close();
console.log('✅ Debug complete!\n');
