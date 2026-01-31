const { db } = require('../database');

console.log('Updating admin user from David Tembo to Hetch Mbunda...\n');

try {
    // Update the existing admin user
    const result = db.prepare(`
        UPDATE users
        SET name = ?, username = ?, email = ?
        WHERE role = 'admin'
    `).run('Hetch Mbunda', 'hetch.mbunda', 'hetch.mbunda@company.com');

    if (result.changes > 0) {
        console.log('✅ Successfully updated admin user:');
        console.log('   Name: Hetch Mbunda');
        console.log('   Username: hetch.mbunda');
        console.log('   Role: admin');
        console.log('   Department: IT');
        console.log('   Email: hetch.mbunda@company.com');
        console.log('   Password: Password123');
        console.log('\n📌 Admin should change password on first login\n');
    } else {
        console.log('⚠️  No admin user found to update');
    }

} catch (error) {
    console.error('❌ Error:', error.message);
}

process.exit(0);
