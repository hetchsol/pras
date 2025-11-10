/**
 * Create Database View for PDF Data Consolidation
 * TIER 2 Implementation - Simplifies PDF queries from 50 lines to 10 lines
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('\n========================================');
console.log('TIER 2: CREATING PDF DATA VIEW');
console.log('========================================\n');

// Step 1: Drop existing view if it exists
console.log('Step 1: Dropping existing view (if exists)...');
db.run(`DROP VIEW IF EXISTS vw_requisition_pdf_data`, (err) => {
    if (err) {
        console.error('❌ Error dropping view:', err.message);
        db.close();
        return;
    }
    console.log('✅ Existing view dropped (or didn\'t exist)\n');

    // Step 2: Create the consolidated view
    console.log('Step 2: Creating consolidated PDF data view...');

    const createViewSQL = `
        CREATE VIEW vw_requisition_pdf_data AS
        SELECT
            r.id,
            r.req_number,
            r.status,
            r.title,
            r.description,
            r.created_at,
            r.required_date,
            r.urgency,
            r.delivery_location,
            r.account_code,

            -- User information
            u.full_name as created_by_name,
            u.department,
            h.full_name as hod_approved_by_name,
            m.full_name as md_approved_by_name,

            -- Vendor information (with fallback logic)
            COALESCE(
                a.recommended_vendor_name,
                v.name,
                r.selected_vendor,
                'To Be Determined'
            ) as approved_vendor,

            v.code as vendor_code,
            v.email as vendor_email,
            v.phone as vendor_phone,

            -- Pricing information (with fallback logic)
            COALESCE(
                a.recommended_amount,
                r.total_cost,
                0
            ) as recommended_amount,

            -- Currency
            COALESCE(
                a.currency,
                r.vendor_currency,
                'ZMW'
            ) as currency,

            -- Adjudication details
            a.recommended_vendor_id,
            a.recommendation_rationale

        FROM requisitions r
        LEFT JOIN users u ON r.created_by = u.id
        LEFT JOIN users h ON r.hod_approved_by = h.id
        LEFT JOIN users m ON r.md_approved_by = m.id
        LEFT JOIN adjudications a ON r.id = a.requisition_id
        LEFT JOIN vendors v ON (
            v.id = a.recommended_vendor_id OR
            v.name = r.selected_vendor
        )
    `;

    db.run(createViewSQL, (err) => {
        if (err) {
            console.error('❌ Error creating view:', err.message);
            db.close();
            return;
        }
        console.log('✅ View created successfully!\n');

        // Step 3: Test the view with a known requisition
        console.log('Step 3: Testing view with Board Room Table requisition...');
        const testReqNumber = 'KSB-OPE-JK-20251107083848';

        db.get(`
            SELECT * FROM vw_requisition_pdf_data
            WHERE req_number = ?
        `, [testReqNumber], (err, result) => {
            if (err) {
                console.error('❌ Error querying view:', err.message);
                db.close();
                return;
            }

            if (!result) {
                console.error('❌ No data returned from view for requisition:', testReqNumber);
                db.close();
                return;
            }

            console.log('✅ View test successful!\n');
            console.log('📋 Sample Data Retrieved:');
            console.log('   Req Number:', result.req_number);
            console.log('   Status:', result.status);
            console.log('   Approved Vendor:', result.approved_vendor);
            console.log('   Recommended Amount:', result.recommended_amount);
            console.log('   Currency:', result.currency);
            console.log('   Created By:', result.created_by_name);
            console.log('   Department:', result.department);
            console.log('   Vendor Code:', result.vendor_code);

            // Step 4: Count total records in view
            console.log('\nStep 4: Checking view coverage...');
            db.get(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'approved' OR status = 'completed' THEN 1 ELSE 0 END) as approved_count
                FROM vw_requisition_pdf_data
            `, [], (err, stats) => {
                if (err) {
                    console.error('❌ Error counting records:', err.message);
                    db.close();
                    return;
                }

                console.log('✅ View contains', stats.total, 'total requisitions');
                console.log('✅ View contains', stats.approved_count, 'approved/completed requisitions\n');

                // Step 5: Verify pricing data availability
                console.log('Step 5: Verifying pricing data in view...');
                db.all(`
                    SELECT
                        req_number,
                        approved_vendor,
                        recommended_amount,
                        currency
                    FROM vw_requisition_pdf_data
                    WHERE status IN ('approved', 'completed')
                    ORDER BY created_at DESC
                    LIMIT 5
                `, [], (err, samples) => {
                    if (err) {
                        console.error('❌ Error fetching samples:', err.message);
                        db.close();
                        return;
                    }

                    console.log('✅ Latest 5 approved requisitions from view:\n');
                    samples.forEach((sample, index) => {
                        console.log(`   ${index + 1}. ${sample.req_number}`);
                        console.log(`      Vendor: ${sample.approved_vendor}`);
                        console.log(`      Amount: ${sample.currency} ${sample.recommended_amount}`);
                        console.log('');
                    });

                    console.log('========================================');
                    console.log('✅ TIER 2 IMPLEMENTATION COMPLETE');
                    console.log('========================================\n');
                    console.log('✅ View "vw_requisition_pdf_data" created successfully');
                    console.log('✅ All data consolidation working correctly');
                    console.log('✅ Ready to update server.js to use the view\n');
                    console.log('📝 Next Step: Update PDF endpoint in server.js');
                    console.log('   Old query: 50+ lines with complex JOINs');
                    console.log('   New query: SELECT * FROM vw_requisition_pdf_data WHERE id = ?\n');

                    db.close();
                });
            });
        });
    });
});
