const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const archivePath = path.join(__dirname, '..', `archive_golive_${Date.now()}.db`);
const backupPath = path.join(__dirname, '..', `backup_before_golive_${Date.now()}.db`);

console.log('='.repeat(70));
console.log('PURCHASE REQUISITION SYSTEM - GO-LIVE ARCHIVING');
console.log('='.repeat(70));
console.log();

// Step 1: Create backup of current database
console.log('Step 1: Creating backup of current database...');
try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup created: ${path.basename(backupPath)}`);
} catch (err) {
    console.error('❌ Failed to create backup:', err.message);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

// Step 2: Create archive database
console.log('\nStep 2: Creating archive database...');
const archiveDb = new sqlite3.Database(archivePath);

function runAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function allAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function archiveData() {
    try {
        // Get schema from main database
        console.log('\nStep 3: Copying database schema to archive...');

        const tables = await allAsync(db,
            "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );

        for (const table of tables) {
            if (table.sql) {
                await runAsync(archiveDb, table.sql);
            }
        }

        // Copy indexes
        const indexes = await allAsync(db,
            "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'"
        );

        for (const index of indexes) {
            if (index.sql) {
                try {
                    await runAsync(archiveDb, index.sql);
                } catch (err) {
                    // Ignore index errors (might already exist)
                }
            }
        }

        console.log('✅ Schema copied to archive database');

        // Step 4: Archive requisitions
        console.log('\nStep 4: Archiving requisitions...');

        const requisitions = await allAsync(db, 'SELECT * FROM requisitions');
        console.log(`Found ${requisitions.length} requisitions to archive`);

        if (requisitions.length > 0) {
            const columns = Object.keys(requisitions[0]).join(', ');
            const placeholders = Object.keys(requisitions[0]).map(() => '?').join(', ');

            for (const req of requisitions) {
                const values = Object.values(req);
                await runAsync(archiveDb,
                    `INSERT INTO requisitions (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            console.log(`✅ Archived ${requisitions.length} requisitions`);
        }

        // Step 5: Archive requisition items
        console.log('\nStep 5: Archiving requisition items...');

        const requisitionItems = await allAsync(db, 'SELECT * FROM requisition_items');
        console.log(`Found ${requisitionItems.length} requisition items to archive`);

        if (requisitionItems.length > 0) {
            const columns = Object.keys(requisitionItems[0]).join(', ');
            const placeholders = Object.keys(requisitionItems[0]).map(() => '?').join(', ');

            for (const item of requisitionItems) {
                const values = Object.values(item);
                await runAsync(archiveDb,
                    `INSERT INTO requisition_items (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            console.log(`✅ Archived ${requisitionItems.length} requisition items`);
        }

        // Step 6: Archive audit log
        console.log('\nStep 6: Archiving audit log...');

        const auditLog = await allAsync(db, 'SELECT * FROM audit_log');
        console.log(`Found ${auditLog.length} audit log entries to archive`);

        if (auditLog.length > 0) {
            const columns = Object.keys(auditLog[0]).join(', ');
            const placeholders = Object.keys(auditLog[0]).map(() => '?').join(', ');

            for (const log of auditLog) {
                const values = Object.values(log);
                await runAsync(archiveDb,
                    `INSERT INTO audit_log (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            console.log(`✅ Archived ${auditLog.length} audit log entries`);
        }

        // Step 7: Archive purchase orders
        console.log('\nStep 7: Archiving purchase orders...');

        const purchaseOrders = await allAsync(db, 'SELECT * FROM purchase_orders');
        console.log(`Found ${purchaseOrders.length} purchase orders to archive`);

        if (purchaseOrders.length > 0) {
            const columns = Object.keys(purchaseOrders[0]).join(', ');
            const placeholders = Object.keys(purchaseOrders[0]).map(() => '?').join(', ');

            for (const po of purchaseOrders) {
                const values = Object.values(po);
                await runAsync(archiveDb,
                    `INSERT INTO purchase_orders (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            console.log(`✅ Archived ${purchaseOrders.length} purchase orders`);
        }

        // Step 8: Archive vendor quotes and adjudications
        console.log('\nStep 8: Archiving vendor quotes and adjudications...');

        const vendorQuotes = await allAsync(db, 'SELECT * FROM vendor_quotes');
        console.log(`Found ${vendorQuotes.length} vendor quotes to archive`);

        if (vendorQuotes.length > 0) {
            const columns = Object.keys(vendorQuotes[0]).join(', ');
            const placeholders = Object.keys(vendorQuotes[0]).map(() => '?').join(', ');

            for (const quote of vendorQuotes) {
                const values = Object.values(quote);
                await runAsync(archiveDb,
                    `INSERT INTO vendor_quotes (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            console.log(`✅ Archived ${vendorQuotes.length} vendor quotes`);
        }

        const adjudications = await allAsync(db, 'SELECT * FROM adjudications');
        console.log(`Found ${adjudications.length} adjudications to archive`);

        if (adjudications.length > 0) {
            const columns = Object.keys(adjudications[0]).join(', ');
            const placeholders = Object.keys(adjudications[0]).map(() => '?').join(', ');

            for (const adj of adjudications) {
                const values = Object.values(adj);
                await runAsync(archiveDb,
                    `INSERT INTO adjudications (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            console.log(`✅ Archived ${adjudications.length} adjudications`);
        }

        // Step 9: Clear production database
        console.log('\nStep 9: Clearing production database for go-live...');

        await runAsync(db, 'DELETE FROM adjudications');
        console.log('✅ Cleared adjudications');

        await runAsync(db, 'DELETE FROM vendor_quotes');
        console.log('✅ Cleared vendor quotes');

        await runAsync(db, 'DELETE FROM purchase_orders');
        console.log('✅ Cleared purchase orders');

        await runAsync(db, 'DELETE FROM audit_log');
        console.log('✅ Cleared audit log');

        await runAsync(db, 'DELETE FROM requisition_items');
        console.log('✅ Cleared requisition items');

        await runAsync(db, 'DELETE FROM requisitions');
        console.log('✅ Cleared requisitions');

        // Reset auto-increment counters
        await runAsync(db, "DELETE FROM sqlite_sequence WHERE name IN ('requisitions', 'requisition_items', 'audit_log', 'purchase_orders', 'vendor_quotes', 'adjudications')");
        console.log('✅ Reset auto-increment counters');

        // Step 10: Generate summary report
        console.log('\nStep 10: Generating summary report...');

        const userCount = await getAsync(db, 'SELECT COUNT(*) as count FROM users');
        const deptCount = await getAsync(db, 'SELECT COUNT(*) as count FROM departments');
        const fxCount = await getAsync(db, 'SELECT COUNT(*) as count FROM fx_rates');
        const budgetCount = await getAsync(db, 'SELECT COUNT(*) as count FROM budgets');

        console.log('\n' + '='.repeat(70));
        console.log('GO-LIVE ARCHIVING COMPLETE');
        console.log('='.repeat(70));
        console.log('\n📦 ARCHIVED DATA:');
        console.log(`   - ${requisitions.length} Requisitions`);
        console.log(`   - ${requisitionItems.length} Requisition Items`);
        console.log(`   - ${auditLog.length} Audit Log Entries`);
        console.log(`   - ${purchaseOrders.length} Purchase Orders`);
        console.log(`   - ${vendorQuotes.length} Vendor Quotes`);
        console.log(`   - ${adjudications.length} Adjudications`);
        console.log('\n✅ RETAINED DATA (Not Archived):');
        console.log(`   - ${userCount.count} Users`);
        console.log(`   - ${deptCount.count} Departments`);
        console.log(`   - ${fxCount.count} FX Rates`);
        console.log(`   - ${budgetCount.count} Budget Entries`);
        console.log('\n💾 FILES CREATED:');
        console.log(`   - Backup: ${path.basename(backupPath)}`);
        console.log(`   - Archive: ${path.basename(archivePath)}`);
        console.log('\n🚀 SYSTEM STATUS: READY FOR GO-LIVE!');
        console.log('\nThe production database is now clean and ready for live operations.');
        console.log('All test data has been archived and can be restored if needed.');
        console.log('='.repeat(70));

        // Create a summary file
        const summaryPath = path.join(__dirname, '..', `GO_LIVE_SUMMARY_${new Date().toISOString().slice(0,10)}.txt`);
        const summary = `
PURCHASE REQUISITION SYSTEM - GO-LIVE ARCHIVING SUMMARY
========================================================
Date: ${new Date().toLocaleString()}
Performed by: System Administrator

ARCHIVED DATA:
--------------
✓ ${requisitions.length} Requisitions
✓ ${requisitionItems.length} Requisition Items
✓ ${auditLog.length} Audit Log Entries
✓ ${purchaseOrders.length} Purchase Orders
✓ ${vendorQuotes.length} Vendor Quotes
✓ ${adjudications.length} Adjudications

RETAINED DATA (Configuration):
-------------------------------
✓ ${userCount.count} Users
✓ ${deptCount.count} Departments
✓ ${fxCount.count} FX Rates
✓ ${budgetCount.count} Budget Entries

FILES CREATED:
--------------
✓ Backup Database: ${path.basename(backupPath)}
✓ Archive Database: ${path.basename(archivePath)}
✓ Summary Report: ${path.basename(summaryPath)}

SYSTEM STATUS:
--------------
🚀 READY FOR GO-LIVE

The production database has been cleaned and all test/development data
has been safely archived. The system is now ready for live operations.

Users, departments, FX rates, and budgets have been preserved.

RESTORE INSTRUCTIONS (if needed):
----------------------------------
To restore archived data:
1. Stop the server
2. Backup current database: purchase_requisition.db
3. Copy archive to production: ${path.basename(archivePath)} -> purchase_requisition.db
4. Restart server

To restore from backup:
1. Stop the server
2. Copy backup to production: ${path.basename(backupPath)} -> purchase_requisition.db
3. Restart server

========================================================
GO-LIVE ARCHIVING COMPLETED SUCCESSFULLY
========================================================
`;

        fs.writeFileSync(summaryPath, summary);
        console.log(`\n📄 Summary saved to: ${path.basename(summaryPath)}`);

    } catch (err) {
        console.error('\n❌ Error during archiving:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        archiveDb.close();
        db.close();
    }
}

// Run the archiving process
archiveData().then(() => {
    console.log('\n✅ All operations completed successfully!');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
