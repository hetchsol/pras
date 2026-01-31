const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('\n=== USER SUPERVISOR MAPPING ===\n');

const users = db.prepare(`
    SELECT id, full_name, username, role, department, assigned_hod
    FROM users
    ORDER BY department, role
`).all();

let currentDept = '';

users.forEach(user => {
    if (user.department !== currentDept) {
        currentDept = user.department;
        console.log('\n📁 DEPARTMENT:', user.department || 'N/A');
        console.log('─'.repeat(60));
    }

    const hodInfo = user.assigned_hod
        ? users.find(u => u.id === user.assigned_hod)
        : null;

    console.log('👤', user.full_name || user.username);
    console.log('   Username:', user.username);
    console.log('   Role:', user.role.toUpperCase());
    console.log('   Supervisor/HOD:', hodInfo ? (hodInfo.full_name || hodInfo.username) : 'None');
    console.log('');
});

db.close();
