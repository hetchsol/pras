const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function consolidateDatabase() {
    console.log('🔄 Database Consolidation Script\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const backendDir = path.join(__dirname, '..');
    const oldDbsDir = path.join(backendDir, 'old-dbs');

    // Database paths
    const sourceDb = path.join(backendDir, 'requisitions.db');
    const targetDb = path.join(backendDir, 'purchase_requisition.db');

    try {
    // Step 1: Copy users from requisitions.db to purchase_requisition.db
    console.log('📋 Step 1: Syncing users from requisitions.db to purchase_requisition.db\n');

    const source = new Database(sourceDb);
    const target = new Database(targetDb);

    // Disable foreign key constraints temporarily
    target.pragma('foreign_keys = OFF');

    // Get all users from source database
    const sourceUsers = source.prepare('SELECT * FROM users').all();
    console.log(`   Found ${sourceUsers.length} users in requisitions.db`);

    // Clear existing users in target (except we'll re-add them)
    target.prepare('DELETE FROM users').run();
    console.log('   ✅ Cleared existing users from purchase_requisition.db');

    // Insert all users into target (mapping name -> full_name)
    const insertStmt = target.prepare(`
        INSERT INTO users (id, username, password, full_name, role, department, email, is_hod, assigned_hod, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let syncedCount = 0;
    for (const user of sourceUsers) {
        insertStmt.run(
            user.id,
            user.username,
            user.password,
            user.name,  // Maps to full_name in target
            user.role,
            user.department,
            user.email,
            user.is_hod || 0,
            user.assigned_hod || null,
            user.created_at || new Date().toISOString()
        );
        syncedCount++;
    }

    console.log(`   ✅ Synced ${syncedCount} users to purchase_requisition.db\n`);

    // Verify the sync
    const targetUsers = target.prepare('SELECT * FROM users').all();
    console.log('   📊 Verification:');
    console.log(`      - Source (requisitions.db): ${sourceUsers.length} users`);
    console.log(`      - Target (purchase_requisition.db): ${targetUsers.length} users`);

    if (sourceUsers.length === targetUsers.length) {
        console.log('   ✅ User count matches!\n');
    } else {
        console.log('   ⚠️  User count mismatch!\n');
    }

    // Re-enable foreign key constraints
    target.pragma('foreign_keys = ON');

    source.close();
    target.close();

    // Wait a bit for the database connections to fully close
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Move old database files
    console.log('📦 Step 2: Moving old database files to old-dbs folder\n');

    // Get all .db files in backend directory
    const allFiles = fs.readdirSync(backendDir);
    const dbFiles = allFiles.filter(file =>
        file.endsWith('.db') &&
        file !== 'purchase_requisition.db' &&
        fs.statSync(path.join(backendDir, file)).isFile()
    );

    console.log(`   Found ${dbFiles.length} database files to move:\n`);

    let movedCount = 0;
    for (const dbFile of dbFiles) {
        const sourcePath = path.join(backendDir, dbFile);
        const targetPath = path.join(oldDbsDir, dbFile);

        fs.renameSync(sourcePath, targetPath);
        console.log(`   ✅ Moved: ${dbFile}`);
        movedCount++;
    }

    console.log(`\n   📊 Total files moved: ${movedCount}\n`);

    // Step 3: Report final state
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ DATABASE CONSOLIDATION COMPLETE!\n');
    console.log('📊 Final State:');
    console.log(`   - Active Database: purchase_requisition.db (${targetUsers.length} users)`);
    console.log(`   - Archived Databases: ${movedCount} files in old-dbs/`);
    console.log('\n📌 Next Steps:');
    console.log('   1. Update database.js to reference purchase_requisition.db');
    console.log('   2. Search codebase for any remaining references to old databases');
    console.log('   3. Test login functionality\n');

    } catch (error) {
        console.error('❌ Error during consolidation:', error.message);
        console.error(error.stack);
        process.exit(1);
    }

    process.exit(0);
}

consolidateDatabase();
