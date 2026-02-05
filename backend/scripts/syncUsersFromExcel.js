/**
 * Sync users from Excel spreadsheet to database
 * Handles: duplicates, username fixes, supervisor assignments, missing fields
 *
 * Run from backend directory: node scripts/syncUsersFromExcel.js
 */

const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'purchase_requisition.db');
const EXCEL_PATH = path.join(__dirname, '..', 'Users_Depts (1).xlsx');

const db = new sqlite3.Database(DB_PATH);

// Promisify db methods
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
}
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
    });
}

async function main() {
    console.log('=== User Sync from Excel ===\n');

    // 1. Read Excel
    const wb = XLSX.readFile(EXCEL_PATH);
    const excelUsers = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    console.log(`Excel: ${excelUsers.length} users`);

    // 2. Read DB users
    const dbUsers = await dbAll('SELECT * FROM users ORDER BY id');
    console.log(`Database: ${dbUsers.length} users\n`);

    // 3. Ensure can_access_stores column exists
    try {
        await dbRun('ALTER TABLE users ADD COLUMN can_access_stores BOOLEAN DEFAULT 0');
        console.log('Added can_access_stores column');
    } catch (e) {
        // Column already exists
    }

    // 4. Map role names from Excel to DB format
    function normalizeRole(role) {
        const map = {
            'initiator': 'initiator',
            'hod': 'hod',
            'procurement': 'procurement',
            'finance manager': 'finance',
            'finance': 'finance',
            'md': 'md',
            'admin': 'admin'
        };
        return map[role.toLowerCase()] || role.toLowerCase();
    }

    // 5. Build supervisor name → user ID mapping
    // First, build from Excel data matched to DB
    const supervisorNameToId = {};
    // HODs and special roles from Excel
    for (const eu of excelUsers) {
        const role = normalizeRole(eu['Role']);
        if (role === 'hod' || role === 'md' || role === 'finance') {
            // Find this user in DB by employee number
            const dbUser = dbUsers.find(u => u.employee_number === eu['Employee Number']);
            if (dbUser) {
                // Map the full name (as it appears in Supervisor column) to user ID
                // The supervisor column uses "Firstname Lastname" format sometimes
                const fullName = eu['FullName']; // e.g., "Munthali Joe Chabawela"
                // Extract likely supervisor reference name
                // In the Supervisor column, names appear as: "Joe Munthali", "Moses Shebele", etc.
                supervisorNameToId[dbUser.full_name] = dbUser.id;
            }
        }
    }

    // Also map by how supervisors appear in the Supervisor column
    // Manually map the known supervisor names to their DB IDs
    const knownSupervisors = {};
    for (const eu of excelUsers) {
        if (eu['Supervisor']) {
            const supName = eu['Supervisor'].trim();
            if (!knownSupervisors[supName]) {
                // Find this supervisor in DB by matching full_name
                // Supervisors are referenced as "Joe Munthali", "Moses Shebele", etc.
                // DB full_names are "Munthali Joe Chabawela", "Shebele Moses", etc.
                // Try to find by checking if first/last names match
                const parts = supName.split(' ');
                const match = dbUsers.find(u => {
                    const dbParts = u.full_name.trim().split(/\s+/);
                    // Check if all parts of the supervisor name appear in the DB full name
                    return parts.every(p => dbParts.some(dp => dp.toLowerCase() === p.toLowerCase()));
                });
                if (match) {
                    knownSupervisors[supName] = match.id;
                }
            }
        }
    }
    console.log('Supervisor name → ID mapping:');
    for (const [name, id] of Object.entries(knownSupervisors)) {
        const user = dbUsers.find(u => u.id === id);
        console.log(`  "${name}" → ID ${id} (${user.username})`);
    }
    console.log('');

    // 6. Identify duplicates by employee number
    // Group DB users by employee number
    const dbByEmpNum = {};
    for (const u of dbUsers) {
        if (u.employee_number) {
            if (!dbByEmpNum[u.employee_number]) dbByEmpNum[u.employee_number] = [];
            dbByEmpNum[u.employee_number].push(u);
        }
    }

    // Find DB users without employee numbers that match Excel users by similar username/name
    const dbWithoutEmpNum = dbUsers.filter(u => !u.employee_number && u.username !== 'admin');

    const duplicatePairs = []; // [{keep: id, delete: id, reason: '...'}]

    for (const orphan of dbWithoutEmpNum) {
        // Try to find a matching Excel user
        for (const eu of excelUsers) {
            const excelUsername = eu['User Name'];
            const excelEmpNum = eu['Employee Number'];

            // Check if there's already a DB user with this emp number
            const existingWithEmpNum = dbUsers.find(u => u.employee_number === excelEmpNum);

            if (existingWithEmpNum && existingWithEmpNum.id !== orphan.id) {
                // Check if the orphan is a duplicate of this user
                const nameSimilar = orphan.full_name.toLowerCase().replace(/\s+/g, '') ===
                    existingWithEmpNum.full_name.toLowerCase().replace(/\s+/g, '');
                const usernameSimilar = orphan.username.replace(/\./g, '').toLowerCase().includes(
                    excelUsername.replace(/\./g, '').split('.').reverse().join('').toLowerCase().substring(0, 5)
                ) || excelUsername.replace(/\./g, '').toLowerCase().includes(
                    orphan.username.replace(/\./g, '').toLowerCase().substring(0, 5)
                );

                // More specific matching
                const orphanParts = orphan.full_name.toLowerCase().split(/\s+/);
                const existingParts = existingWithEmpNum.full_name.toLowerCase().split(/\s+/);
                const nameOverlap = orphanParts.filter(p => existingParts.includes(p)).length;

                if (nameOverlap >= 1 && (nameSimilar || usernameSimilar)) {
                    duplicatePairs.push({
                        keepId: orphan.id,
                        deleteId: existingWithEmpNum.id,
                        orphanUsername: orphan.username,
                        dupeUsername: existingWithEmpNum.username,
                        excelUsername: excelUsername,
                        empNum: excelEmpNum,
                        reason: `"${orphan.username}" (id ${orphan.id}) ↔ "${existingWithEmpNum.username}" (id ${existingWithEmpNum.id})`
                    });
                }
            }
        }
    }

    console.log(`Found ${duplicatePairs.length} duplicate pairs:`);
    for (const dp of duplicatePairs) {
        console.log(`  ${dp.reason}`);
        console.log(`    Excel username: "${dp.excelUsername}", keep id ${dp.keepId}, delete id ${dp.deleteId}`);
    }
    console.log('');

    // 7. Process duplicates - keep older entry, update it, delete newer
    for (const dp of duplicatePairs) {
        // Reassign any records from the duplicate to the kept user
        const tables = [
            'requisitions', 'petty_cash_forms', 'fuel_request_forms',
            'travel_request_forms', 'issue_slips', 'picking_slips'
        ];

        for (const table of tables) {
            try {
                // Update initiator_id references
                const result = await dbRun(
                    `UPDATE ${table} SET initiator_id = ? WHERE initiator_id = ?`,
                    [dp.keepId, dp.deleteId]
                );
                if (result.changes > 0) {
                    console.log(`  Reassigned ${result.changes} records in ${table} from id ${dp.deleteId} → ${dp.keepId}`);
                }
            } catch (e) {
                // Table or column might not exist
            }
            try {
                const result = await dbRun(
                    `UPDATE ${table} SET user_id = ? WHERE user_id = ?`,
                    [dp.keepId, dp.deleteId]
                );
                if (result.changes > 0) {
                    console.log(`  Reassigned ${result.changes} records in ${table} (user_id) from id ${dp.deleteId} → ${dp.keepId}`);
                }
            } catch (e) {
                // Table or column might not exist
            }
        }

        // Update the kept user's username to match Excel
        await dbRun(
            'UPDATE users SET username = ? WHERE id = ?',
            [dp.excelUsername, dp.keepId]
        );
        console.log(`  Updated username: "${dp.orphanUsername}" → "${dp.excelUsername}" (id ${dp.keepId})`);

        // Delete the duplicate
        await dbRun('DELETE FROM users WHERE id = ?', [dp.deleteId]);
        console.log(`  Deleted duplicate user id ${dp.deleteId} ("${dp.dupeUsername}")`);
    }

    // 8. Refresh DB users after duplicate cleanup
    const updatedDbUsers = await dbAll('SELECT * FROM users ORDER BY id');
    const deletedIds = duplicatePairs.map(dp => dp.deleteId);

    // 9. Process each Excel user - update matching DB records
    console.log('\n=== Updating users from Excel ===\n');

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const eu of excelUsers) {
        const excelUsername = eu['User Name'];
        const excelFullName = eu['FullName'].trim();
        const excelEmail = eu['Email'];
        const excelRole = normalizeRole(eu['Role']);
        const excelDept = eu['Department'];
        const excelEmpNum = eu['Employee Number'];
        const excelSupervisor = eu['Supervisor'] ? eu['Supervisor'].trim() : null;

        // Find matching DB user by employee_number or username
        let dbUser = updatedDbUsers.find(u => u.employee_number === excelEmpNum);
        if (!dbUser) {
            dbUser = updatedDbUsers.find(u => u.username === excelUsername);
        }

        if (!dbUser) {
            console.log(`NOT FOUND in DB: ${excelUsername} (${excelFullName}) - ${excelEmpNum}`);
            notFoundCount++;
            continue;
        }

        // Determine assigned_hod ID
        let assignedHodId = null;
        let isHod = 0;

        if (excelRole === 'hod') {
            isHod = 1;
            assignedHodId = null; // HODs don't have a supervisor HOD
        } else if (excelRole === 'md') {
            assignedHodId = null; // MD doesn't have a supervisor
        } else if (excelSupervisor) {
            // Look up supervisor ID
            assignedHodId = knownSupervisors[excelSupervisor] || null;
            if (!assignedHodId) {
                console.log(`  WARNING: Could not find supervisor "${excelSupervisor}" for ${excelUsername}`);
            }
        }

        // Build update
        const changes = [];

        if (dbUser.full_name.trim() !== excelFullName) changes.push(`full_name: "${dbUser.full_name}" → "${excelFullName}"`);
        if (dbUser.email !== excelEmail) changes.push(`email: "${dbUser.email}" → "${excelEmail}"`);
        if (dbUser.role !== excelRole) changes.push(`role: "${dbUser.role}" → "${excelRole}"`);
        if (dbUser.department !== excelDept) changes.push(`department: "${dbUser.department}" → "${excelDept}"`);
        if (dbUser.employee_number !== excelEmpNum) changes.push(`employee_number: "${dbUser.employee_number}" → "${excelEmpNum}"`);
        if (dbUser.is_hod !== isHod) changes.push(`is_hod: ${dbUser.is_hod} → ${isHod}`);

        // Compare assigned_hod (could be string or int in DB)
        const currentHod = dbUser.assigned_hod;
        if (currentHod !== assignedHodId) {
            const currentLabel = currentHod ? `"${currentHod}"` : 'null';
            const newLabel = assignedHodId ? `${assignedHodId}` : 'null';
            changes.push(`assigned_hod: ${currentLabel} → ${newLabel}`);
        }

        if (dbUser.username !== excelUsername) changes.push(`username: "${dbUser.username}" → "${excelUsername}"`);

        if (changes.length > 0) {
            console.log(`${excelUsername} (id ${dbUser.id}):`);
            changes.forEach(c => console.log(`  ${c}`));

            await dbRun(`
                UPDATE users
                SET full_name = ?, email = ?, role = ?, department = ?,
                    employee_number = ?, is_hod = ?, assigned_hod = ?, username = ?
                WHERE id = ?
            `, [excelFullName, excelEmail, excelRole, excelDept, excelEmpNum, isHod, assignedHodId, excelUsername, dbUser.id]);

            updatedCount++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Duplicates resolved: ${duplicatePairs.length}`);
    console.log(`Users updated: ${updatedCount}`);
    console.log(`Users not found in DB: ${notFoundCount}`);

    // 10. Final state
    const finalUsers = await dbAll('SELECT id, username, full_name, role, department, employee_number, is_hod, assigned_hod FROM users ORDER BY id');
    console.log(`\nFinal user count: ${finalUsers.length}`);
    console.log('\nFinal user list:');
    console.log('ID  | Username             | Full Name                | Role        | Dept       | Emp#  | HOD | Supervisor ID');
    console.log('----|----------------------|--------------------------|-------------|------------|-------|-----|-------------');
    for (const u of finalUsers) {
        const id = String(u.id).padEnd(3);
        const username = (u.username || '').padEnd(20);
        const name = (u.full_name || '').padEnd(24);
        const role = (u.role || '').padEnd(11);
        const dept = (u.department || '').padEnd(10);
        const emp = (u.employee_number || '-').padEnd(5);
        const hod = u.is_hod ? 'Yes' : 'No ';
        const sup = u.assigned_hod !== null ? String(u.assigned_hod) : '-';
        console.log(`${id} | ${username} | ${name} | ${role} | ${dept} | ${emp} | ${hod} | ${sup}`);
    }

    db.close();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err);
    db.close();
    process.exit(1);
});
