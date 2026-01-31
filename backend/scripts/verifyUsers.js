const { db } = require('../database');
const { comparePassword } = require('../utils/auth');

async function verifyUsers() {
    console.log('🔍 Verifying all user accounts...\n');

    const users = db.prepare('SELECT id, username, password, name, role FROM users').all();

    console.log(`Found ${users.length} users in database\n`);

    for (const user of users) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`User: ${user.name}`);
        console.log(`Username: ${user.username}`);
        console.log(`Role: ${user.role}`);
        console.log(`Password Hash: ${user.password.substring(0, 30)}...`);

        // Test if password matches
        try {
            const isMatch = await comparePassword('Password123', user.password);
            if (isMatch) {
                console.log(`✅ Password verification: SUCCESS`);
                console.log(`   Login with: ${user.username} / Password123`);
            } else {
                console.log(`❌ Password verification: FAILED`);
            }
        } catch (error) {
            console.log(`❌ Error verifying password: ${error.message}`);
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

verifyUsers().then(() => process.exit(0)).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
