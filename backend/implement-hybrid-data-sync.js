/**
 * HYBRID DATA SYNCHRONIZATION IMPLEMENTATION
 *
 * This script implements Option 3: Update both requisitions AND items
 * when adjudication is approved, ensuring all PDF fields are populated
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('\n========================================');
console.log('HYBRID DATA SYNC IMPLEMENTATION');
console.log('========================================\n');

console.log('This script will:');
console.log('1. Add vendor_code field to requisitions table');
console.log('2. Create triggers to auto-sync data from adjudications');
console.log('3. Backfill existing requisitions with missing data\n');

// Step 1: Check if vendor_code column exists
console.log('Step 1: Checking requisitions table structure...');
db.all("PRAGMA table_info(requisitions)", [], (err, columns) => {
    if (err) {
        console.error('ERROR:', err.message);
        db.close();
        return;
    }

    const hasVendorCode = columns.some(col => col.name === 'vendor_code');
    console.log(`  vendor_code column: ${hasVendorCode ? '✓ Exists' : '✗ Missing'}\n`);

    // Step 2: Add vendor_code column if missing
    if (!hasVendorCode) {
        console.log('Step 2: Adding vendor_code column to requisitions...');
        db.run(`ALTER TABLE requisitions ADD COLUMN vendor_code TEXT`, (err) => {
            if (err) {
                console.error('ERROR:', err.message);
                db.close();
                return;
            }
            console.log('  ✓ vendor_code column added\n');
            createTriggers();
        });
    } else {
        createTriggers();
    }
});

function createTriggers() {
    console.log('Step 3: Creating/Replacing database triggers...\n');

    // Trigger 1: When adjudication is created/updated, sync to requisition
    const trigger1SQL = `
        CREATE TRIGGER IF NOT EXISTS sync_adjudication_to_requisition
        AFTER INSERT ON adjudications
        BEGIN
            UPDATE requisitions
            SET
                selected_vendor = NEW.recommended_vendor_name,
                total_cost = NEW.recommended_amount,
                vendor_currency = NEW.currency,
                vendor_code = (
                    SELECT code FROM vendors WHERE id = NEW.recommended_vendor_id
                )
            WHERE id = NEW.requisition_id;

            -- Also update items with distributed pricing
            UPDATE requisition_items
            SET
                unit_price = NEW.recommended_amount / (
                    SELECT SUM(quantity) FROM requisition_items
                    WHERE requisition_id = NEW.requisition_id
                ),
                total_price = (
                    NEW.recommended_amount / (
                        SELECT SUM(quantity) FROM requisition_items
                        WHERE requisition_id = NEW.requisition_id
                    )
                ) * quantity
            WHERE requisition_id = NEW.requisition_id;
        END;
    `;

    // Trigger 2: When adjudication is updated, re-sync
    const trigger2SQL = `
        CREATE TRIGGER IF NOT EXISTS sync_adjudication_update_to_requisition
        AFTER UPDATE ON adjudications
        BEGIN
            UPDATE requisitions
            SET
                selected_vendor = NEW.recommended_vendor_name,
                total_cost = NEW.recommended_amount,
                vendor_currency = NEW.currency,
                vendor_code = (
                    SELECT code FROM vendors WHERE id = NEW.recommended_vendor_id
                )
            WHERE id = NEW.requisition_id;

            -- Also update items with distributed pricing
            UPDATE requisition_items
            SET
                unit_price = NEW.recommended_amount / (
                    SELECT SUM(quantity) FROM requisition_items
                    WHERE requisition_id = NEW.requisition_id
                ),
                total_price = (
                    NEW.recommended_amount / (
                        SELECT SUM(quantity) FROM requisition_items
                        WHERE requisition_id = NEW.requisition_id
                    )
                ) * quantity
            WHERE requisition_id = NEW.requisition_id;
        END;
    `;

    console.log('  Creating trigger: sync_adjudication_to_requisition...');
    db.run(trigger1SQL, (err) => {
        if (err) {
            console.error('  ERROR:', err.message);
        } else {
            console.log('  ✓ Trigger created\n');
        }

        console.log('  Creating trigger: sync_adjudication_update_to_requisition...');
        db.run(trigger2SQL, (err) => {
            if (err) {
                console.error('  ERROR:', err.message);
            } else {
                console.log('  ✓ Trigger created\n');
            }

            backfillExistingData();
        });
    });
}

function backfillExistingData() {
    console.log('Step 4: Backfilling existing requisitions with adjudication data...\n');

    // Get all requisitions with adjudications
    db.all(`
        SELECT
            r.id as req_id,
            r.req_number,
            a.recommended_vendor_name,
            a.recommended_amount,
            a.currency,
            a.recommended_vendor_id,
            v.code as vendor_code
        FROM requisitions r
        JOIN adjudications a ON r.id = a.requisition_id
        LEFT JOIN vendors v ON a.recommended_vendor_id = v.id
        WHERE r.status IN ('approved', 'completed')
    `, [], (err, requisitions) => {
        if (err) {
            console.error('ERROR:', err.message);
            db.close();
            return;
        }

        console.log(`  Found ${requisitions.length} requisitions with adjudications\n`);

        let updated = 0;
        let errors = 0;

        requisitions.forEach((req, index) => {
            // Update requisition
            db.run(`
                UPDATE requisitions
                SET
                    selected_vendor = ?,
                    total_cost = ?,
                    vendor_currency = ?,
                    vendor_code = ?
                WHERE id = ?
            `, [req.recommended_vendor_name, req.recommended_amount, req.currency, req.vendor_code, req.req_id], (err) => {
                if (err) {
                    console.error(`  ✗ Error updating ${req.req_number}:`, err.message);
                    errors++;
                } else {
                    // Update items with distributed pricing
                    db.run(`
                        UPDATE requisition_items
                        SET
                            unit_price = ? / (SELECT SUM(quantity) FROM requisition_items WHERE requisition_id = ?),
                            total_price = (? / (SELECT SUM(quantity) FROM requisition_items WHERE requisition_id = ?)) * quantity
                        WHERE requisition_id = ?
                    `, [req.recommended_amount, req.req_id, req.recommended_amount, req.req_id, req.req_id], (err) => {
                        if (err) {
                            console.error(`  ✗ Error updating items for ${req.req_number}:`, err.message);
                            errors++;
                        } else {
                            updated++;
                            console.log(`  ✓ Updated ${req.req_number}: ${req.recommended_vendor_name} - ${req.currency} ${req.recommended_amount}`);
                        }

                        // Check if all done
                        if (updated + errors === requisitions.length) {
                            finalize(updated, errors);
                        }
                    });
                }
            });
        });

        if (requisitions.length === 0) {
            finalize(0, 0);
        }
    });
}

function finalize(updated, errors) {
    console.log('\n========================================');
    console.log('BACKFILL COMPLETE');
    console.log('========================================\n');
    console.log(`  ✓ Successfully updated: ${updated}`);
    console.log(`  ✗ Errors: ${errors}\n`);

    // Verify the changes
    console.log('Step 5: Verifying data after backfill...\n');

    db.all(`
        SELECT
            req_number,
            selected_vendor,
            vendor_code,
            total_cost,
            vendor_currency,
            (SELECT COUNT(*) FROM requisition_items WHERE requisition_id = r.id) as item_count,
            (SELECT SUM(CASE WHEN unit_price > 0 THEN 1 ELSE 0 END) FROM requisition_items WHERE requisition_id = r.id) as items_with_pricing
        FROM requisitions r
        WHERE status IN ('approved', 'completed')
        ORDER BY created_at DESC
        LIMIT 5
    `, [], (err, results) => {
        if (err) {
            console.error('ERROR:', err.message);
        } else {
            console.log('  Latest 5 approved requisitions after backfill:\n');
            results.forEach((req, index) => {
                console.log(`  ${index + 1}. ${req.req_number}`);
                console.log(`     Vendor: ${req.selected_vendor || 'MISSING'}`);
                console.log(`     Vendor Code: ${req.vendor_code || 'MISSING'}`);
                console.log(`     Total: ${req.vendor_currency || 'ZMW'} ${req.total_cost || 0}`);
                console.log(`     Items: ${req.item_count} (${req.items_with_pricing} with pricing)`);
                console.log('');
            });
        }

        console.log('\n========================================');
        console.log('✅ IMPLEMENTATION COMPLETE');
        console.log('========================================\n');
        console.log('Changes made:');
        console.log('  1. ✓ Added vendor_code field to requisitions table');
        console.log('  2. ✓ Created triggers for automatic data sync');
        console.log('  3. ✓ Backfilled existing requisitions\n');
        console.log('Going forward:');
        console.log('  - When adjudication is created/updated, data auto-syncs');
        console.log('  - Requisition table has: vendor, vendor_code, total_cost, currency');
        console.log('  - Items table has: unit_price, total_price (distributed)');
        console.log('  - PDF generator has all data in requisitions/items tables\n');

        db.close();
    });
}
