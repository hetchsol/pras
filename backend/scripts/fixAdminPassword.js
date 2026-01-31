const { db } = require('../database');
const { hashPassword } = require('../utils/auth');

async function fixAdminPassword() {
    console.log('🔧 Fixing admin password...\n');

    try {
        // Hash the password properly
        const hashedPassword = await hashPassword('Password123');

        // Update admin password
        const result = db.prepare(`
            UPDATE users
            SET password = ?
            WHERE role = 'admin'
        `).run(hashedPassword);

        if (result.changes > 0) {
            console.log('✅ Admin password updated successfully');
            console.log('   Username: hetch.mbunda');
            console.log('   Password: Password123');
            console.log('   Password is now properly hashed\n');
        } else {
            console.log('⚠️  No admin user found');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

fixAdminPassword();
