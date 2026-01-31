const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');

console.log('='.repeat(70));
console.log('FINANCE DEPARTMENT - HOD ASSIGNMENT & NEW USER CREATION');
console.log('='.repeat(70));
console.log();

const db = new sqlite3.Database(dbPath);

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function updateAndCreate() {
    try {
        // Step 1: Assign Anne Banda to Finance initiators
        console.log('Step 1: Assigning Anne Banda as HOD to Finance initiators...');

        const result = await runAsync(
            "UPDATE users SET assigned_hod = ? WHERE role = ? AND department = ? AND assigned_hod IS NULL",
            ['Anne Banda', 'initiator', 'Finance']
        );

        console.log(`✅ Updated ${result.changes} Finance initiator(s) with Anne Banda as HOD`);
        console.log();

        // Verify the updates
        const financeInitiators = await allAsync(
            "SELECT username, full_name, assigned_hod FROM users WHERE role = ? AND department = ?",
            ['initiator', 'Finance']
        );

        console.log('Finance Initiators after update:');
        financeInitiators.forEach(u => {
            console.log(`  - ${u.full_name} (${u.username}): HOD = ${u.assigned_hod}`);
        });
        console.log();

        // Step 2: Check if user already exists
        console.log('Step 2: Checking if mwansa.mwelwa already exists...');
        const existingUser = await getAsync(
            "SELECT id, username FROM users WHERE username = ?",
            ['mwansa.mwelwa']
        );

        if (existingUser) {
            console.log(`⚠️  User 'mwansa.mwelwa' already exists (ID: ${existingUser.id})`);
            console.log('Skipping user creation.');
            console.log();
        } else {
            console.log('✓ Username available');
            console.log();

            // Step 3: Hash password
            console.log('Step 3: Hashing password...');
            const password = 'password123';
            const hashedPassword = await bcrypt.hash(password, 10);
            console.log('✓ Password hashed');
            console.log();

            // Step 4: Create new user
            console.log('Step 4: Creating new user mwansa.mwelwa...');

            const insertResult = await runAsync(
                `INSERT INTO users (username, password, full_name, email, role, department, is_hod, assigned_hod, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    'mwansa.mwelwa',
                    hashedPassword,
                    'Mwansa Mwelwa',
                    '',
                    'initiator',
                    'Finance',
                    0,
                    'Anne Banda'
                ]
            );

            console.log(`✅ User created successfully!`);
            console.log(`   - Username: mwansa.mwelwa`);
            console.log(`   - Password: password123`);
            console.log(`   - Full Name: Mwansa Mwelwa`);
            console.log(`   - Role: initiator`);
            console.log(`   - Department: Finance`);
            console.log(`   - Assigned HOD: Anne Banda`);
            console.log(`   - User ID: ${insertResult.lastID}`);
            console.log();
        }

        // Step 5: Summary - Show all Finance users
        console.log('Step 5: Finance Department Summary');
        console.log('='.repeat(70));

        const allFinanceUsers = await allAsync(
            "SELECT id, username, full_name, role, assigned_hod FROM users WHERE department = ? ORDER BY role, username",
            ['Finance']
        );

        console.log(`Total Finance Department Users: ${allFinanceUsers.length}`);
        console.log();
        console.log('Role'.padEnd(15) + 'Username'.padEnd(25) + 'Full Name'.padEnd(25) + 'Assigned HOD');
        console.log('-'.repeat(90));

        allFinanceUsers.forEach(u => {
            console.log(
                u.role.padEnd(15) +
                u.username.padEnd(25) +
                u.full_name.padEnd(25) +
                (u.assigned_hod || 'N/A')
            );
        });

        console.log();
        console.log('='.repeat(70));
        console.log('ALL TASKS COMPLETED SUCCESSFULLY');
        console.log('='.repeat(70));
        console.log();
        console.log('Summary:');
        console.log('✓ Finance initiators now have Anne Banda as assigned HOD');
        console.log('✓ New initiator user created: mwansa.mwelwa');
        console.log('✓ All Finance department users verified');
        console.log();

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        db.close();
    }
}

updateAndCreate().then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
