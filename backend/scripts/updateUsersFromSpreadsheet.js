const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');

async function updateUsers() {
    console.log('📊 Reading Users_Depts (1).xlsx...\n');

    // Read the Excel file
    const workbook = XLSX.readFile(path.join(__dirname, '..', 'Users_Depts (1).xlsx'));
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} users in spreadsheet\n`);

    const db = new Database(path.join(__dirname, '..', 'purchase_requisition.db'));

    try {
        // First, check if employee_number column exists, if not add it
        const columns = db.prepare('PRAGMA table_info(users)').all();
        const hasEmployeeNumber = columns.some(col => col.name === 'employee_number');

        if (!hasEmployeeNumber) {
            console.log('➕ Adding employee_number column to users table...');
            db.prepare('ALTER TABLE users ADD COLUMN employee_number TEXT').run();
            console.log('✅ Column added\n');
        }

        // Hash the default password
        const hashedPassword = await bcrypt.hash('Password123', 10);

        // Get existing users
        const existingUsers = db.prepare('SELECT username, full_name FROM users').all();
        const existingUsernames = new Set(existingUsers.map(u => u.username));

        console.log(`Existing users in database: ${existingUsers.length}\n`);
        console.log('═══════════════════════════════════════════════════════════\n');

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const departments = new Set();
        const hodsByDept = {};
        const supervisorMap = {}; // Map to store supervisor names and their usernames

        // First pass: collect departments and identify HODs/Supervisors
        for (const row of data) {
            const department = row['Department'];
            const role = (row['Role'] || 'initiator').toLowerCase();
            const username = row['User Name'];
            const fullName = row['FullName'] || row['Full Name'];
            const supervisor = row['Supervisor'];

            if (department) {
                departments.add(department);

                if (role === 'hod' || role === 'supervisor') {
                    hodsByDept[department] = username;
                }
            }

            // Build supervisor mapping (name -> username)
            if (username && fullName) {
                supervisorMap[fullName] = username;
            }
        }

        // Ensure all departments exist in database
        console.log('🏢 Updating Departments Table...\n');

        // Check if departments table has budget column
        const deptColumns = db.prepare('PRAGMA table_info(departments)').all();
        const hasBudget = deptColumns.some(col => col.name === 'budget');
        const hasCode = deptColumns.some(col => col.name === 'code');

        // Get current max department number for code generation
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
                // Generate department code: first 3 letters + sequential number
                const prefix = dept.substring(0, 3).toUpperCase();
                const code = `${prefix}${String(deptCounter).padStart(3, '0')}`;

                if (hasCode) {
                    db.prepare(`
                        INSERT INTO departments (name, code, description, is_active, created_at, updated_at)
                        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `).run(dept, code, `${dept} Department`);
                } else if (hasBudget) {
                    db.prepare(`
                        INSERT INTO departments (name, budget, spent)
                        VALUES (?, 0, 0)
                    `).run(dept);
                } else {
                    db.prepare(`
                        INSERT INTO departments (name)
                        VALUES (?)
                    `).run(dept);
                }
                console.log(`✅ Created department: ${dept} [${code}]`);
                deptCounter++;
            }
        }
        console.log(`\nTotal departments: ${departments.size}\n`);
        console.log('═══════════════════════════════════════════════════════════\n');

        // Second pass: create/update users
        for (const row of data) {
            // Extract data from spreadsheet
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

            // Determine if user is HOD/Supervisor
            const isHod = (role === 'hod' || role === 'supervisor') ? 1 : 0;

            // Normalize role (convert supervisor to hod, finance manager to finance)
            if (role === 'supervisor') {
                role = 'hod';
            }
            if (role === 'finance manager') {
                role = 'finance';
            }

            // Check if user exists
            if (existingUsernames.has(username)) {
                // Update existing user
                try {
                    db.prepare(`
                        UPDATE users
                        SET full_name = ?, employee_number = ?, email = ?, department = ?, role = ?, is_hod = ?
                        WHERE username = ?
                    `).run(fullName, employeeNumber, email, department, role, isHod, username);

                    console.log(`✏️  Updated: ${employeeNumber ? employeeNumber.padEnd(8) : '        '} ${username.padEnd(25)} | ${fullName.padEnd(30)} | ${role}${isHod ? ' [HOD]' : ''}`);
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

                    console.log(`✅ Created: ${employeeNumber ? employeeNumber.padEnd(8) : '        '} ${username.padEnd(25)} | ${fullName.padEnd(30)} | ${role}${isHod ? ' [HOD]' : ''}`);
                    created++;
                } catch (error) {
                    console.log(`❌ Error creating ${username}: ${error.message}`);
                    skipped++;
                }
            }
        }

        // Third pass: Assign HODs to department members based on supervisor field
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔗 Assigning Supervisors/HODs to Users...\n');

        for (const row of data) {
            const username = row['User Name'];
            const supervisorName = row['Supervisor'];
            const role = (row['Role'] || 'initiator').toLowerCase();

            if (supervisorName && role === 'initiator') {
                const supervisorUsername = supervisorMap[supervisorName];

                if (supervisorUsername) {
                    const supervisorUser = db.prepare('SELECT id FROM users WHERE username = ?').get(supervisorUsername);

                    if (supervisorUser) {
                        db.prepare(`
                            UPDATE users
                            SET assigned_hod = ?
                            WHERE username = ?
                        `).run(supervisorUser.id, username);

                        console.log(`✅ Assigned ${supervisorName} to ${username}`);
                    }
                }
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ User Update Complete!\n');
        console.log(`📊 Summary:`);
        console.log(`   - Created: ${created} new users`);
        console.log(`   - Updated: ${updated} existing users`);
        console.log(`   - Skipped: ${skipped} rows`);
        console.log(`   - Total in spreadsheet: ${data.length}`);

        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
        console.log(`   - Total users in database: ${totalUsers.count}\n`);

        // Show all users
        console.log('📋 All Users in Database:');
        console.log('═══════════════════════════════════════════════════════════');
        const allUsers = db.prepare(`
            SELECT u.username, u.full_name, u.employee_number, u.role, u.department, u.is_hod,
                   h.full_name as supervisor_name
            FROM users u
            LEFT JOIN users h ON u.assigned_hod = h.id
            ORDER BY u.department, u.full_name
        `).all();

        let currentDept = '';
        for (const user of allUsers) {
            if (user.department !== currentDept) {
                currentDept = user.department;
                console.log(`\n🏢 ${currentDept}:`);
            }
            const empNum = user.employee_number ? `[${user.employee_number}]` : '';
            const supervisor = user.supervisor_name ? `→ ${user.supervisor_name}` : '';
            const hod = user.is_hod ? '[HOD]' : '';
            console.log(`   ${empNum.padEnd(8)} ${user.full_name.padEnd(30)} | ${user.username.padEnd(25)} | ${user.role} ${hod} ${supervisor}`);
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔑 Default Password for all new users: Password123\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }

    db.close();
}

updateUsers().then(() => process.exit(0));
