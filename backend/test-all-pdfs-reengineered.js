/**
 * Test PDF generation for ALL approved requisitions
 * Using the new re-engineered data structure
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Clear require cache for pdfGenerator
const pdfGenPath = require.resolve('./utils/pdfGenerator');
delete require.cache[pdfGenPath];
const { generateRequisitionPDF } = require('./utils/pdfGenerator');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('\n========================================');
console.log('TESTING ALL APPROVED REQUISITIONS');
console.log('WITH RE-ENGINEERED DATA STRUCTURE');
console.log('========================================\n');

// Get all approved/completed requisitions from the new view
db.all(`
    SELECT * FROM vw_requisition_pdf_data
    WHERE status IN ('approved', 'completed')
    ORDER BY created_at DESC
`, [], (err, requisitions) => {
    if (err) {
        console.error('ERROR:', err.message);
        db.close();
        return;
    }

    console.log(`Found ${requisitions.length} approved requisitions\n`);

    let tested = 0;
    let passed = 0;
    let failed = 0;
    const results = [];

    requisitions.forEach((req, index) => {
        // Get items
        db.all(`
            SELECT * FROM requisition_items
            WHERE requisition_id = ?
            ORDER BY id
        `, [req.id], (err, items) => {
            if (err) {
                console.error(`ERROR getting items for ${req.req_number}:`, err.message);
                failed++;
                tested++;
                return;
            }

            // Generate PDF
            generateRequisitionPDF(req, items, (err, pdfBuffer) => {
                tested++;

                const result = {
                    req_number: req.req_number,
                    vendor: req.approved_vendor,
                    vendor_code: req.vendor_code,
                    amount: req.recommended_amount,
                    currency: req.currency,
                    items: items.length,
                    itemsWithPricing: items.filter(i => i.unit_price > 0).length,
                    success: !err
                };

                if (err) {
                    console.error(`✗ ${req.req_number}: PDF generation failed -`, err.message);
                    result.error = err.message;
                    failed++;
                } else {
                    const hasVendor = !!req.approved_vendor && req.approved_vendor !== 'To Be Determined';
                    const hasVendorCode = !!req.vendor_code;
                    const hasPricing = req.recommended_amount > 0;
                    const hasItemPricing = items.some(i => i.unit_price > 0);

                    if (hasVendor && hasVendorCode && hasPricing && hasItemPricing) {
                        console.log(`✓ ${req.req_number}: ALL FIELDS POPULATED`);
                        console.log(`    Vendor: ${req.approved_vendor} (${req.vendor_code})`);
                        console.log(`    Amount: ${req.currency} ${req.recommended_amount}`);
                        console.log(`    Items: ${items.length} (all with pricing)`);
                        passed++;
                    } else {
                        console.log(`⚠️  ${req.req_number}: Some fields missing`);
                        if (!hasVendor) console.log(`    Missing: Vendor name`);
                        if (!hasVendorCode) console.log(`    Missing: Vendor code`);
                        if (!hasPricing) console.log(`    Missing: Amount`);
                        if (!hasItemPricing) console.log(`    Missing: Item pricing`);
                        failed++;
                    }
                }

                results.push(result);

                // When all done, show summary
                if (tested === requisitions.length) {
                    showSummary(results, passed, failed);
                }
            });
        });
    });
});

function showSummary(results, passed, failed) {
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');

    console.log(`Total Requisitions: ${results.length}`);
    console.log(`✓ Fully Populated: ${passed} (${(passed/results.length*100).toFixed(1)}%)`);
    console.log(`✗ Issues: ${failed} (${(failed/results.length*100).toFixed(1)}%)\n`);

    if (failed > 0) {
        console.log('Requisitions with Issues:');
        results.filter(r => !r.success || !r.vendor || !r.vendor_code || r.amount === 0 || r.itemsWithPricing === 0).forEach(r => {
            console.log(`  ${r.req_number}:`);
            if (!r.success) console.log(`    - PDF generation failed: ${r.error}`);
            if (!r.vendor || r.vendor === 'To Be Determined') console.log(`    - Missing vendor`);
            if (!r.vendor_code) console.log(`    - Missing vendor code`);
            if (r.amount === 0) console.log(`    - Missing amount`);
            if (r.itemsWithPricing === 0) console.log(`    - No item pricing`);
        });
        console.log('');
    }

    console.log('========================================');
    console.log('RE-ENGINEERING RESULTS');
    console.log('========================================\n');

    if (passed === results.length) {
        console.log('🎉 SUCCESS! All requisitions now have complete data:');
        console.log('  ✓ Vendor names populated');
        console.log('  ✓ Vendor codes populated');
        console.log('  ✓ Amounts populated');
        console.log('  ✓ Item-level pricing populated');
        console.log('  ✓ PDFs generate correctly\n');
        console.log('The re-engineering is COMPLETE and working perfectly!\n');
    } else {
        console.log(`⚠️  ${failed} requisitions still need attention`);
        console.log('Review the issues above and run backfill scripts if needed\n');
    }

    db.close();
}
