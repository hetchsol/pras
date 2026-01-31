const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

async function addUsers() {
    console.log('👥 Adding Finance Manager and Managing Director\n');

    const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

    try {
        // Hash the default password
        const hashedPassword = await bcrypt.hash('Password123', 10);

        // Add Anne Banda - Finance Manager
        console.log('Adding Anne Banda (Finance Manager)...');
        db.prepare(`
            INSERT INTO users (username, password, full_name, email, role, department, is_hod, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            'anne.banda',
            hashedPassword,
            'Anne Banda',
            'anne.banda@company.com',
            'finance',
            'Finance',
            0
        );
        console.log('✅ Anne Banda added successfully');
        console.log('   Username: anne.banda');
        console.log('   Role: finance');
        console.log('   Department: Finance');
        console.log('   Password: Password123\n');

        // Add Kanyembo Ndhlovu - Managing Director
        console.log('Adding Kanyembo Ndhlovu (Managing Director)...');
        db.prepare(`
            INSERT INTO users (username, password, full_name, email, role, department, is_hod, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            'kanyembo.ndhlovu',
            hashedPassword,
            'Kanyembo Ndhlovu',
            'kanyembo.ndhlovu@company.com',
            'md',
            'Executive',
            0
        );
        console.log('✅ Kanyembo Ndhlovu added successfully');
        console.log('   Username: kanyembo.ndhlovu');
        console.log('   Role: md');
        console.log('   Department: Executive');
        console.log('   Password: Password123\n');

        // Verify additions
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ Users Added Successfully!\n');
        console.log(`📊 Total users in system: ${totalUsers.count}`);
        console.log('\n📌 Both users should change their passwords on first login\n');

    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            console.error('⚠️  One or both users already exist in the database');
        } else {
            console.error('❌ Error:', error.message);
        }
        process.exit(1);
    }

    db.close();
}

addUsers().then(() => process.exit(0));
