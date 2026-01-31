const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

console.log('\n=== TESTING API FILTERING AS JOE MUNTHALI ===\n');

// 1. Get Joe's user record
const joe = db.prepare(`
    SELECT id, full_name, username, role, department
    FROM users
    WHERE username = ?
`).get('joe.munthali');

if (!joe) {
    console.log('❌ Joe Munthali not found!');
    process.exit(1);
}

console.log('1️⃣ JOE\'S USER RECORD:');
console.log('   ID:', joe.id);
console.log('   Full Name:', joe.full_name);
console.log('   Username:', joe.username);
console.log('   Role:', joe.role);
console.log('   Department:', `"${joe.department}"`);
console.log('   Department Length:', joe.department.length);
console.log('   Department Hex:', Buffer.from(joe.department).toString('hex'));
console.log('');

// 2. Get all petty cash requisitions
const requisitions = db.prepare(`
    SELECT id, payee_name, amount, purpose, department, initiator_id, initiator_name, status
    FROM petty_cash_requisitions
    ORDER BY created_at DESC
`).all();

console.log('2️⃣ ALL PETTY CASH REQUISITIONS:');
requisitions.forEach(r => {
    console.log('   ID:', r.id);
    console.log('   Department:', `"${r.department}"`);
    console.log('   Department Length:', r.department.length);
    console.log('   Department Hex:', Buffer.from(r.department).toString('hex'));
    console.log('   Status:', r.status);
    console.log('   Initiator ID:', r.initiator_id);
    console.log('');
});

// 3. Simulate the filtering logic exactly as in the route
console.log('3️⃣ SIMULATING BACKEND FILTERING LOGIC:');
console.log('   userRole:', joe.role);
console.log('   userDepartment:', `"${joe.department}"`);
console.log('');

let filteredRequisitions = requisitions;

if (joe.role === 'hod') {
    const userDepartment = joe.department;
    filteredRequisitions = requisitions.filter(r => {
        const isOwn = r.initiator_id === joe.id;
        const isDept = r.department === userDepartment;
        const isStatus = r.status === 'pending_hod';

        console.log('   Checking:', r.id);
        console.log('      Is own:', isOwn, `(${r.initiator_id} === ${joe.id})`);
        console.log('      Is dept match:', isDept, `("${r.department}" === "${userDepartment}")`);
        console.log('      Is pending_hod:', isStatus, `("${r.status}" === "pending_hod")`);
        console.log('      Combined:', isOwn || (isDept && isStatus));
        console.log('');

        return isOwn || (isDept && isStatus);
    });
}

console.log('4️⃣ FILTERED RESULTS:');
console.log('   Total requisitions:', requisitions.length);
console.log('   Filtered for Joe:', filteredRequisitions.length);
console.log('');

if (filteredRequisitions.length > 0) {
    console.log('   ✅ Joe should see these requisitions:');
    filteredRequisitions.forEach(r => {
        console.log('      -', r.id, '-', r.purpose);
    });
} else {
    console.log('   ❌ Joe should NOT see any requisitions');
    console.log('');
    console.log('   🔍 DEBUGGING WHY:');

    // Check for department name issues
    requisitions.forEach(r => {
        console.log('');
        console.log('      Requisition:', r.id);
        console.log('      Req Dept Bytes:', [...Buffer.from(r.department)]);
        console.log('      Joe Dept Bytes:', [...Buffer.from(joe.department)]);
        console.log('      Exact Match:', r.department === joe.department);
        console.log('      Trimmed Match:', r.department.trim() === joe.department.trim());
    });
}

db.close();
console.log('\n✅ Test complete!\n');
