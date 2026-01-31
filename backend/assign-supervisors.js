const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'purchase_requisition.db'));

console.log('🔄 Assigning supervisors/HODs to users...\n');

try {
    // Get all HODs by department
    const hods = db.prepare(`
        SELECT id, full_name, username, department
        FROM users
        WHERE role = 'hod'
    `).all();

    console.log('📋 Found HODs:');
    hods.forEach(hod => {
        console.log(`  - ${hod.full_name} (${hod.department})`);
    });
    console.log('');

    let totalAssigned = 0;

    // For each HOD, assign them to all initiators in their department
    hods.forEach(hod => {
        console.log(`\n📁 Assigning ${hod.full_name} as supervisor for ${hod.department} department...`);

        const result = db.prepare(`
            UPDATE users
            SET assigned_hod = ?
            WHERE department = ?
            AND role IN ('initiator', 'procurement')
            AND id != ?
        `).run(hod.id, hod.department, hod.id);

        console.log(`   ✅ Assigned to ${result.changes} users`);
        totalAssigned += result.changes;
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`✅ Successfully assigned supervisors to ${totalAssigned} users`);
    console.log('─'.repeat(60));

    // Show the updated assignments
    console.log('\n📊 Updated User-Supervisor Mapping:\n');

    const users = db.prepare(`
        SELECT u.id, u.full_name, u.username, u.role, u.department, u.assigned_hod,
               h.full_name as hod_name, h.username as hod_username
        FROM users u
        LEFT JOIN users h ON u.assigned_hod = h.id
        WHERE u.role IN ('initiator', 'procurement')
        ORDER BY u.department, u.full_name
    `).all();

    let currentDept = '';
    users.forEach(user => {
        if (user.department !== currentDept) {
            currentDept = user.department;
            console.log(`\n📁 ${user.department}`);
            console.log('─'.repeat(60));
        }

        console.log(`👤 ${user.full_name}`);
        console.log(`   Role: ${user.role.toUpperCase()}`);
        console.log(`   Supervisor: ${user.hod_name || 'None'} ${user.hod_username ? '(' + user.hod_username + ')' : ''}`);
        console.log('');
    });

    db.close();
    console.log('\n✅ All done!\n');

} catch (error) {
    console.error('❌ Error:', error);
    db.close();
    process.exit(1);
}
