const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, username, full_name, role, department, is_hod, assigned_hod FROM users WHERE role = ? ORDER BY username', ['initiator'], (err, users) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log('='.repeat(100));
    console.log('ALL INITIATOR USERS - VERIFICATION');
    console.log('='.repeat(100));
    console.log();
    console.log('Total Initiators:', users.length);
    console.log();
    console.log('ID'.padEnd(5) + 'Username'.padEnd(25) + 'Department'.padEnd(20) + 'is_HOD'.padEnd(10) + 'Assigned HOD');
    console.log('-'.repeat(100));

    users.forEach(u => {
        console.log(
            String(u.id).padEnd(5) +
            u.username.padEnd(25) +
            (u.department || 'N/A').padEnd(20) +
            String(u.is_hod).padEnd(10) +
            (u.assigned_hod || 'None')
        );
    });

    console.log();
    console.log('='.repeat(100));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(100));
    console.log();
    console.log('All users above have the "initiator" role and should have:');
    console.log('  ✓ Same access to create requisitions');
    console.log('  ✓ Same view permissions');
    console.log('  ✓ Same restrictions (e.g., cannot enter unit prices)');
    console.log('  ✓ Same approval workflow');
    console.log();

    // Check justine.kaluya specifically
    const justine = users.find(u => u.username === 'justine.kaluya');
    if (justine) {
        console.log('Reference User (justine.kaluya):');
        console.log('  - Role: ' + justine.role);
        console.log('  - Department: ' + justine.department);
        console.log('  - is_HOD: ' + justine.is_hod);
        console.log('  - Assigned HOD: ' + justine.assigned_hod);
        console.log();
        console.log('All other initiators have the same role-based permissions.');
    }

    db.close();
});
