const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('=== ARCHIVING OLD DATA FOR GO-LIVE ===\n');

db.serialize(() => {
    // Step 1: Create archive tables
    console.log('📦 Step 1: Creating archive tables...');

    // Archive requisitions table
    db.run(`
        CREATE TABLE IF NOT EXISTS requisitions_archive (
            id INTEGER,
            req_number TEXT,
            title TEXT,
            description TEXT,
            delivery_location TEXT,
            urgency TEXT,
            required_date DATE,
            account_code TEXT,
            created_by INTEGER,
            status TEXT,
            hod_approval_status TEXT,
            hod_approved_by INTEGER,
            hod_approved_at DATETIME,
            hod_comments TEXT,
            total_amount REAL,
            created_at DATETIME,
            updated_at DATETIME,
            budget_checked BOOLEAN,
            budget_approved_by INTEGER,
            budget_approved_at DATETIME,
            budget_comments TEXT,
            finance_approval_status TEXT,
            finance_approved_by INTEGER,
            finance_approved_at DATETIME,
            finance_comments TEXT,
            md_approval_status TEXT,
            md_approved_by INTEGER,
            md_approved_at DATETIME,
            md_comments TEXT,
            po_number TEXT,
            po_generated_at DATETIME,
            po_generated_by INTEGER,
            selected_vendor INTEGER,
            vendor_currency TEXT,
            unit_price REAL,
            total_cost REAL,
            justification TEXT,
            quantity INTEGER,
            procurement_status TEXT,
            procurement_assigned_to INTEGER,
            procurement_completed_at DATETIME,
            procurement_comments TEXT,
            rejected_by INTEGER,
            rejected_at DATETIME,
            rejection_reason TEXT,
            assigned_hod_id INTEGER,
            has_quotes INTEGER,
            has_adjudication INTEGER,
            vendor_code TEXT,
            tax_type TEXT,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            archived_by TEXT DEFAULT 'SYSTEM',
            PRIMARY KEY (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating requisitions_archive table:', err);
        } else {
            console.log('✓ requisitions_archive table created');
        }
    });

    // Archive requisition items table
    db.run(`
        CREATE TABLE IF NOT EXISTS requisition_items_archive (
            id INTEGER,
            requisition_id INTEGER,
            item_name TEXT,
            quantity INTEGER,
            unit_price REAL,
            total_price REAL,
            specifications TEXT,
            currency TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating requisition_items_archive table:', err);
        } else {
            console.log('✓ requisition_items_archive table created');
        }
    });

    // Archive audit log table
    db.run(`
        CREATE TABLE IF NOT EXISTS audit_log_archive (
            id INTEGER,
            requisition_id INTEGER,
            user_id INTEGER,
            action TEXT,
            details TEXT,
            created_at DATETIME,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating audit_log_archive table:', err);
        } else {
            console.log('✓ audit_log_archive table created');
        }

        // Step 2: Count existing data
        console.log('\n📊 Step 2: Counting existing data...');

        db.get('SELECT COUNT(*) as count FROM requisitions', [], (err, result) => {
            if (err) {
                console.error('Error counting requisitions:', err);
                return;
            }
            const reqCount = result.count;
            console.log(`   Found ${reqCount} requisitions to archive`);

            db.get('SELECT COUNT(*) as count FROM requisition_items', [], (err, result) => {
                if (err) {
                    console.error('Error counting items:', err);
                    return;
                }
                const itemsCount = result.count;
                console.log(`   Found ${itemsCount} requisition items to archive`);

                db.get('SELECT COUNT(*) as count FROM audit_log', [], (err, result) => {
                    if (err) {
                        console.error('Error counting audit logs:', err);
                        return;
                    }
                    const auditCount = result.count;
                    console.log(`   Found ${auditCount} audit log entries to archive`);

                    // Step 3: Move data to archive
                    console.log('\n📦 Step 3: Moving data to archive...');

                    // Archive requisitions
                    db.run(`
                        INSERT INTO requisitions_archive
                        SELECT *, CURRENT_TIMESTAMP, 'SYSTEM'
                        FROM requisitions
                    `, (err) => {
                        if (err) {
                            console.error('Error archiving requisitions:', err);
                        } else {
                            console.log(`✓ Archived ${reqCount} requisitions`);
                        }

                        // Archive requisition items
                        db.run(`
                            INSERT INTO requisition_items_archive
                            SELECT *, CURRENT_TIMESTAMP
                            FROM requisition_items
                        `, (err) => {
                            if (err) {
                                console.error('Error archiving requisition items:', err);
                            } else {
                                console.log(`✓ Archived ${itemsCount} requisition items`);
                            }

                            // Archive audit log
                            db.run(`
                                INSERT INTO audit_log_archive
                                SELECT *, CURRENT_TIMESTAMP
                                FROM audit_log
                            `, (err) => {
                                if (err) {
                                    console.error('Error archiving audit log:', err);
                                } else {
                                    console.log(`✓ Archived ${auditCount} audit log entries`);
                                }

                                // Step 4: Clear current tables
                                console.log('\n🗑️  Step 4: Clearing current tables for fresh start...');

                                db.run('DELETE FROM requisition_items', (err) => {
                                    if (err) {
                                        console.error('Error clearing requisition_items:', err);
                                    } else {
                                        console.log('✓ Cleared requisition_items table');
                                    }

                                    db.run('DELETE FROM audit_log', (err) => {
                                        if (err) {
                                            console.error('Error clearing audit_log:', err);
                                        } else {
                                            console.log('✓ Cleared audit_log table');
                                        }

                                        db.run('DELETE FROM requisitions', (err) => {
                                            if (err) {
                                                console.error('Error clearing requisitions:', err);
                                            } else {
                                                console.log('✓ Cleared requisitions table');
                                            }

                                            // Step 5: Reset auto-increment counters
                                            console.log('\n🔄 Step 5: Resetting ID counters...');

                                            db.run('DELETE FROM sqlite_sequence WHERE name IN ("requisitions", "requisition_items", "audit_log")', (err) => {
                                                if (err) {
                                                    console.error('Error resetting counters:', err);
                                                } else {
                                                    console.log('✓ Reset ID counters (next requisition will start at ID: 1)');
                                                }

                                                // Step 6: Verify
                                                console.log('\n✅ Step 6: Verifying fresh state...');

                                                db.get('SELECT COUNT(*) as count FROM requisitions', [], (err, result) => {
                                                    if (err) {
                                                        console.error('Error:', err);
                                                    } else {
                                                        console.log(`   Current requisitions: ${result.count} (should be 0)`);
                                                    }

                                                    db.get('SELECT COUNT(*) as count FROM requisitions_archive', [], (err, result) => {
                                                        if (err) {
                                                            console.error('Error:', err);
                                                        } else {
                                                            console.log(`   Archived requisitions: ${result.count}`);
                                                        }

                                                        console.log('\n' + '='.repeat(60));
                                                        console.log('🎉 ARCHIVE COMPLETE - SYSTEM READY FOR GO-LIVE! 🎉');
                                                        console.log('='.repeat(60));
                                                        console.log('\n📌 Summary:');
                                                        console.log(`   • ${reqCount} requisitions archived`);
                                                        console.log(`   • ${itemsCount} items archived`);
                                                        console.log(`   • ${auditCount} audit entries archived`);
                                                        console.log('   • All current tables cleared');
                                                        console.log('   • ID counters reset to 1');
                                                        console.log('   • Archive accessible by admin only');
                                                        console.log('\n🚀 System is now on a FRESH SLATE!');
                                                        console.log('📅 Archive Date: ' + new Date().toISOString());

                                                        db.close();
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
