const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');

async function syncUsers() {
    console.log('📊 Reading Users_Depts (1).xlsx...\n');

    // Read the Excel file
    const workbook = XLSX.readFile(path.join(__dirname, '..', 'Users_Depts (1).xlsx'));
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} users in spreadsheet\n`);

    const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

    try {
        // Hash the password - using "password123" as requested
        const hashedPassword = await bcrypt.hash('password123', 10);
        console.log('🔐 Password hash generated for: password123\n');

        // Check if employee_number column exists, if not add it
        const columns = db.prepare('PRAGMA table_info(users)').all();
        const hasEmployeeNumber = columns.some(col => col.name === 'employee_number');

        if (!hasEmployeeNumber) {
            console.log('➕ Adding employee_number column to users table...');
            db.prepare('ALTER TABLE users ADD COLUMN employee_number TEXT').run();
            console.log('✅ Column added\n');
        }

        // Get existing users
        const existingUsers = db.prepare('SELECT username FROM users').all();
        const existingUsernames = new Set(existingUsers.map(u => u.username));

        // Build supervisor mapping (name -> username)
        const supervisorMap = {};
        for (const row of data) {
            const username = row['User Name'];
            const fullName = row['FullName'] || row['Full Name'];
            if (username && fullName) {
                supervisorMap[fullName] = username;
            }
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const departments = new Set();

        console.log('═══════════════════════════════════════════════════════════');
        console.log('👥 Processing Users...\n');

        // Process each user from spreadsheet
        for (const row of data) {
            const employeeNumber = row['Employee Number'];
            const username = row['User Name'];
            const fullName = row['FullName'] || row['Full Name'];
            const email = row['Email'] || `${username}@company.com`;
            const department = row['Department'] || 'General';
            let role = (row['Role'] || 'initiator').toLowerCase();
            const supervisorName = row['Supervisor'];

            if (!username || !fullName) {
                console.log(`⚠️  Skipping row - missing username or name:`, row);
                skipped++;
                continue;
            }

            departments.add(department);

            // Determine if user is HOD/Supervisor
            const isHod = (role === 'hod' || role === 'supervisor') ? 1 : 0;

            // Normalize roles
            if (role === 'supervisor') role = 'hod';
            if (role === 'finance manager') role = 'finance';

            // Check if user exists
            if (existingUsernames.has(username)) {
                // Update existing user - including password reset
                try {
                    db.prepare(`
                        UPDATE users
                        SET full_name = ?, employee_number = ?, email = ?, department = ?, role = ?, is_hod = ?, password = ?
                        WHERE username = ?
                    `).run(fullName, employeeNumber, email, department, role, isHod, hashedPassword, username);

                    console.log(`✏️  Updated: ${username.padEnd(22)} | ${role.padEnd(12)} | ${department}`);
                    updated++;
                } catch (error) {
                    console.log(`❌ Error updating ${username}: ${error.message}`);
                    skipped++;
                }
            } else {
                // Create new user
                try {
                    db.prepare(`
                        INSERT INTO users (username, password, full_name, employee_number, email, role, department, is_hod, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `).run(username, hashedPassword, fullName, employeeNumber, email, role, department, isHod);

                    console.log(`✅ Created: ${username.padEnd(22)} | ${role.padEnd(12)} | ${department}`);
                    created++;
                } catch (error) {
                    console.log(`❌ Error creating ${username}: ${error.message}`);
                    skipped++;
                }
            }
        }

        // Ensure departments exist
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🏢 Updating Departments...\n');

        const deptColumns = db.prepare('PRAGMA table_info(departments)').all();
        const hasBudget = deptColumns.some(col => col.name === 'budget');
        const hasCode = deptColumns.some(col => col.name === 'code');

        let deptCounter = 1;
        if (hasCode) {
            const existingDepts = db.prepare('SELECT code FROM departments').all();
            if (existingDepts.length > 0) {
                const maxNum = Math.max(...existingDepts.map(d => {
                    const match = d.code.match(/\d+$/);
                    return match ? parseInt(match[0]) : 0;
                }));
                deptCounter = maxNum + 1;
            }
        }

        for (const dept of departments) {
            const existing = db.prepare('SELECT * FROM departments WHERE name = ?').get(dept);
            if (!existing) {
                const prefix = dept.substring(0, 3).toUpperCase();
                const code = `${prefix}${String(deptCounter).padStart(3, '0')}`;

                if (hasCode) {
                    db.prepare(`
                        INSERT INTO departments (name, code, description, is_active, created_at, updated_at)
                        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `).run(dept, code, `${dept} Department`);
                } else if (hasBudget) {
                    db.prepare('INSERT INTO departments (name, budget, spent) VALUES (?, 0, 0)').run(dept);
                } else {
                    db.prepare('INSERT INTO departments (name) VALUES (?)').run(dept);
                }
                console.log(`✅ Created department: ${dept}`);
                deptCounter++;
            }
        }

        // Assign supervisors to users
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔗 Assigning Supervisors...\n');

        for (const row of data) {
            const username = row['User Name'];
            const supervisorName = row['Supervisor'];
            const role = (row['Role'] || 'initiator').toLowerCase();

            if (supervisorName && (role === 'initiator' || role === 'procurement')) {
                const supervisorUsername = supervisorMap[supervisorName];

                if (supervisorUsername) {
                    const supervisorUser = db.prepare('SELECT id FROM users WHERE username = ?').get(supervisorUsername);

                    if (supervisorUser) {
                        db.prepare('UPDATE users SET assigned_hod = ? WHERE username = ?').run(supervisorUser.id, username);
                        console.log(`✅ ${username} → ${supervisorName}`);
                    }
                }
            }
        }

        // Summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 SUMMARY\n');
        console.log(`   Created: ${created} new users`);
        console.log(`   Updated: ${updated} existing users`);
        console.log(`   Skipped: ${skipped} rows`);

        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
        console.log(`   Total users in database: ${totalUsers.count}\n`);

        // Verify hetch.mbunda admin status
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔐 ADMIN VERIFICATION\n');

        const hetch = db.prepare('SELECT id, username, full_name, role FROM users WHERE username = ?').get('hetch.mbunda');
        if (hetch) {
            console.log(`   hetch.mbunda found: role = ${hetch.role}`);
            if (hetch.role === 'admin') {
                console.log('   ✅ hetch.mbunda has ADMIN role - can reset passwords');
            } else {
                console.log('   ⚠️  hetch.mbunda role is not admin');
            }
        } else {
            console.log('   ❌ hetch.mbunda not found in database');
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔑 All users password set to: password123');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }

    db.close();
}

syncUsers().then(() => process.exit(0));
