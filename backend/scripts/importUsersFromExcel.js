const XLSX = require('xlsx');
const path = require('path');
const { db, createUser, getUsers } = require('../database');
const { hashPassword } = require('../utils/auth');

async function importUsersFromExcel() {
    console.log('📊 Reading Excel file...');

    const filePath = path.join(__dirname, '..', 'Users_Depts.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // First sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`\n✅ Found ${data.length} rows in spreadsheet\n`);

    // Clear existing users (except keep one admin for safety)
    console.log('🗑️  Clearing existing users...');
    db.prepare("DELETE FROM users WHERE role != 'admin' OR username != 'admin'").run();

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        try {
            // Extract data from columns - adjust these based on your Excel structure
            const name = row['Name'] || row['Full Name'] || row['name'] || row['full_name'];
            const department = row['Department'] || row['department'];
            const role = row['Role'] || row['role'];
            const email = row['Email'] || row['email'];

            if (!name || !department) {
                console.log(`⚠️  Row ${i + 1}: Missing name or department, skipping...`);
                errorCount++;
                continue;
            }

            // Generate username from name (firstname.lastname)
            const nameParts = name.trim().split(' ');
            const firstName = nameParts[0].toLowerCase();
            const lastName = nameParts[nameParts.length - 1].toLowerCase();
            const username = `${firstName}.${lastName}`;

            // Determine role - default to 'initiator' if not specified
            let userRole = 'initiator';
            if (role) {
                const roleLower = role.toLowerCase();
                if (roleLower.includes('hod') || roleLower.includes('head')) {
                    userRole = 'hod';
                } else if (roleLower.includes('finance')) {
                    userRole = 'finance';
                } else if (roleLower.includes('procurement')) {
                    userRole = 'procurement';
                } else if (roleLower.includes('md') || roleLower.includes('director')) {
                    userRole = 'md';
                } else if (roleLower.includes('admin')) {
                    userRole = 'admin';
                }
            }

            // Generate email if not provided
            const userEmail = email || `${username}@company.com`;

            // Default password (users should change on first login)
            const defaultPassword = await hashPassword('Password123');

            // Create user
            const user = {
                username,
                password: defaultPassword,
                name,
                role: userRole,
                department,
                email: userEmail
            };

            createUser(user);
            console.log(`✅ Created: ${name} (${username}) - ${userRole} - ${department}`);
            successCount++;

        } catch (error) {
            console.error(`❌ Row ${i + 1}: Error creating user - ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully created: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    // Display all users
    console.log('\n📋 All Users in Database:\n');
    const allUsers = getUsers();
    allUsers.forEach(user => {
        console.log(`  ${user.name.padEnd(30)} | ${user.username.padEnd(20)} | ${user.role.padEnd(12)} | ${user.department}`);
    });

    console.log('\n📌 Default Password for all users: Password123');
    console.log('📌 Users should change their password on first login\n');

    process.exit(0);
}

// Run the import
importUsersFromExcel().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
