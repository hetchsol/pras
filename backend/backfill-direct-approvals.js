/**
 * Backfill requisitions that were approved directly (without adjudication)
 * These need vendor_code populated from the vendors table
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('\n========================================');
console.log('BACKFILL DIRECT APPROVALS');
console.log('========================================\n');

// Get requisitions approved without adjudication
db.all(`
    SELECT
        r.id,
        r.req_number,
        r.selected_vendor,
        r.total_cost,
        r.vendor_currency,
        r.vendor_code as current_vendor_code,
        v.code as vendor_table_code,
        v.id as vendor_id
    FROM requisitions r
    LEFT JOIN adjudications a ON r.id = a.requisition_id
    LEFT JOIN vendors v ON v.name = r.selected_vendor
    WHERE r.status IN ('approved', 'completed')
      AND a.id IS NULL  -- No adjudication
      AND r.selected_vendor IS NOT NULL
`, [], (err, requisitions) => {
    if (err) {
        console.error('ERROR:', err.message);
        db.close();
        return;
    }

    console.log(`Found ${requisitions.length} directly-approved requisitions\n`);

    if (requisitions.length === 0) {
        console.log('✓ No direct approvals need backfilling\n');
        db.close();
        return;
    }

    let updated = 0;
    let errors = 0;

    requisitions.forEach((req, index) => {
        if (!req.vendor_table_code) {
            console.log(`⚠️  ${req.req_number}: Vendor "${req.selected_vendor}" not found in vendors table`);
            errors++;

            if (updated + errors === requisitions.length) {
                finalize(updated, errors);
            }
            return;
        }

        // Update vendor_code and ensure item pricing
        db.run(`
            UPDATE requisitions
            SET vendor_code = ?
            WHERE id = ?
        `, [req.vendor_table_code, req.id], (err) => {
            if (err) {
                console.error(`✗ Error updating ${req.req_number}:`, err.message);
                errors++;
            } else {
                // Update items with pricing if total_cost exists
                if (req.total_cost && req.total_cost > 0) {
                    db.run(`
                        UPDATE requisition_items
                        SET
                            unit_price = ? / (SELECT SUM(quantity) FROM requisition_items WHERE requisition_id = ?),
                            total_price = (? / (SELECT SUM(quantity) FROM requisition_items WHERE requisition_id = ?)) * quantity
                        WHERE requisition_id = ?
                          AND (unit_price IS NULL OR unit_price = 0)
                    `, [req.total_cost, req.id, req.total_cost, req.id, req.id], (err) => {
                        if (err) {
                            console.error(`✗ Error updating items for ${req.req_number}:`, err.message);
                            errors++;
                        } else {
                            updated++;
                            console.log(`✓ ${req.req_number}: ${req.selected_vendor} (${req.vendor_table_code}) - ${req.vendor_currency || 'ZMW'} ${req.total_cost}`);
                        }

                        if (updated + errors === requisitions.length) {
                            finalize(updated, errors);
                        }
                    });
                } else {
                    updated++;
                    console.log(`✓ ${req.req_number}: Added vendor code ${req.vendor_table_code}`);

                    if (updated + errors === requisitions.length) {
                        finalize(updated, errors);
                    }
                }
            }
        });
    });
});

function finalize(updated, errors) {
    console.log('\n========================================');
    console.log('BACKFILL COMPLETE');
    console.log('========================================\n');
    console.log(`  ✓ Successfully updated: ${updated}`);
    console.log(`  ✗ Errors: ${errors}\n`);

    // Verify
    db.all(`
        SELECT
            req_number,
            selected_vendor,
            vendor_code,
            total_cost,
            vendor_currency,
            (SELECT COUNT(*) FROM requisition_items ri WHERE ri.requisition_id = r.id) as item_count,
            (SELECT SUM(CASE WHEN unit_price > 0 THEN 1 ELSE 0 END) FROM requisition_items ri WHERE ri.requisition_id = r.id) as items_with_pricing
        FROM requisitions r
        WHERE status IN ('approved', 'completed')
          AND vendor_code IS NOT NULL
        ORDER BY created_at DESC
    `, [], (err, results) => {
        if (err) {
            console.error('ERROR:', err.message);
        } else {
            console.log(`Verification: ${results.length} requisitions now have vendor_code\n`);
            results.forEach((req, index) => {
                console.log(`  ${index + 1}. ${req.req_number}`);
                console.log(`     Vendor: ${req.selected_vendor}`);
                console.log(`     Code: ${req.vendor_code}`);
                console.log(`     Total: ${req.vendor_currency || 'ZMW'} ${req.total_cost || 0}`);
                console.log(`     Items: ${req.item_count} (${req.items_with_pricing} with pricing)`);
                console.log('');
            });
        }

        db.close();
    });
}
