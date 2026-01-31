const { createUser } = require('../database');
const { hashPassword } = require('../utils/auth');

async function addJustineKaluya() {
    console.log('Adding Justine Kaluya to the database...\n');

    try {
        const password = await hashPassword('Password123');

        const user = {
            username: 'justine.kaluya',
            password: password,
            name: 'Justine Kaluya',
            role: 'initiator',
            department: 'Operations',
            email: 'justine.kaluya@company.com'
        };

        createUser(user);

        console.log('✅ Successfully added:');
        console.log(`   Name: ${user.name}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Department: ${user.department}`);
        console.log(`   Password: Password123`);
        console.log('\n📌 User should change password on first login\n');

    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            console.log('⚠️  User already exists in database');
        } else {
            console.error('❌ Error:', error.message);
        }
    }

    process.exit(0);
}

addJustineKaluya();
