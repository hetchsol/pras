/**
 * Comprehensive Data Flow Analysis
 * Identifies where data should come from and where it's currently missing
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('\n========================================');
console.log('COMPREHENSIVE DATA FLOW ANALYSIS');
console.log('========================================\n');

// Get all approved/completed requisitions with ALL related data
db.all(`
    SELECT
        r.id,
        r.req_number,
        r.status,
        r.title,
        r.description,

        -- Requisition table pricing
        r.unit_price as req_unit_price,
        r.total_cost as req_total_cost,
        r.selected_vendor as req_selected_vendor,
        r.vendor_currency as req_currency,

        -- Adjudication data
        a.id as adj_id,
        a.recommended_vendor_id as adj_vendor_id,
        a.recommended_vendor_name as adj_vendor_name,
        a.recommended_amount as adj_amount,
        a.currency as adj_currency,

        -- Vendor data
        v.id as vendor_id,
        v.name as vendor_name,
        v.code as vendor_code,

        -- User data
        u.full_name as created_by_name

    FROM requisitions r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN adjudications a ON r.id = a.requisition_id
    LEFT JOIN vendors v ON (v.id = a.recommended_vendor_id OR v.name = r.selected_vendor)
    WHERE r.status IN ('approved', 'completed')
    ORDER BY r.created_at DESC
`, [], (err, requisitions) => {
    if (err) {
        console.error('ERROR:', err.message);
        db.close();
        return;
    }

    console.log(`Found ${requisitions.length} approved/completed requisitions\n`);

    let summary = {
        total: requisitions.length,
        withVendorName: 0,
        withVendorCode: 0,
        withAdjudication: 0,
        withReqPricing: 0,
        withItemPricing: 0,
        fullyPopulated: 0,
        issues: []
    };

    // Analyze each requisition
    const analysis = [];
    let processed = 0;

    requisitions.forEach((req, index) => {
        // Get items for this requisition
        db.all(`
            SELECT
                ri.id,
                ri.item_name,
                ri.quantity,
                ri.unit_price as item_unit_price,
                ri.total_price as item_total_price,
                ri.vendor_id as item_vendor_id
            FROM requisition_items ri
            WHERE ri.requisition_id = ?
        `, [req.id], (err, items) => {
            if (err) {
                console.error('ERROR getting items:', err.message);
                return;
            }

            processed++;

            // Analyze this requisition
            const reqAnalysis = {
                req_number: req.req_number,
                status: req.status,
                hasVendorName: !!(req.adj_vendor_name || req.vendor_name || req.req_selected_vendor),
                hasVendorCode: !!req.vendor_code,
                hasAdjudication: !!req.adj_id,
                hasReqPricing: !!(req.req_total_cost && req.req_total_cost > 0),
                hasItemPricing: items.some(item => item.item_unit_price > 0 || item.item_total_price > 0),
                adjAmount: req.adj_amount || 0,
                reqTotalCost: req.req_total_cost || 0,
                itemCount: items.length,
                itemsWithPricing: items.filter(item => item.item_unit_price > 0 || item.item_total_price > 0).length,

                // What vendor name we'd use
                vendorSource: req.adj_vendor_name ? 'adjudication' :
                             req.vendor_name ? 'vendor_table' :
                             req.req_selected_vendor ? 'requisition' : 'NONE',
                vendorValue: req.adj_vendor_name || req.vendor_name || req.req_selected_vendor || 'MISSING',

                // What pricing we'd use
                pricingSource: items.some(item => item.item_unit_price > 0 || item.item_total_price > 0) ? 'items' :
                              (req.req_total_cost && req.req_total_cost > 0) ? 'requisition' :
                              (req.adj_amount && req.adj_amount > 0) ? 'adjudication' : 'NONE',
                pricingValue: items.some(item => item.item_unit_price > 0 || item.item_total_price > 0) ?
                             items.reduce((sum, item) => sum + (item.item_total_price || (item.item_unit_price * item.quantity)), 0) :
                             req.req_total_cost || req.adj_amount || 0,

                items: items
            };

            analysis.push(reqAnalysis);

            // Update summary
            if (reqAnalysis.hasVendorName) summary.withVendorName++;
            if (reqAnalysis.hasVendorCode) summary.withVendorCode++;
            if (reqAnalysis.hasAdjudication) summary.withAdjudication++;
            if (reqAnalysis.hasReqPricing) summary.withReqPricing++;
            if (reqAnalysis.hasItemPricing) summary.withItemPricing++;

            if (reqAnalysis.hasVendorName && reqAnalysis.hasVendorCode && reqAnalysis.pricingValue > 0) {
                summary.fullyPopulated++;
            } else {
                summary.issues.push({
                    req_number: req.req_number,
                    missing: [
                        !reqAnalysis.hasVendorName ? 'Vendor Name' : null,
                        !reqAnalysis.hasVendorCode ? 'Vendor Code' : null,
                        reqAnalysis.pricingValue === 0 ? 'Pricing' : null
                    ].filter(Boolean)
                });
            }

            // When all are processed, display results
            if (processed === requisitions.length) {
                displayAnalysis(analysis, summary);
            }
        });
    });
});

function displayAnalysis(analysis, summary) {
    console.log('========================================');
    console.log('DETAILED ANALYSIS BY REQUISITION');
    console.log('========================================\n');

    analysis.forEach((req, index) => {
        console.log(`${index + 1}. ${req.req_number} (${req.status})`);
        console.log(`   Vendor: ${req.vendorValue} [Source: ${req.vendorSource}]`);
        console.log(`   Vendor Code: ${req.hasVendorCode ? '✓ Present' : '✗ MISSING'}`);
        console.log(`   Pricing: ${req.pricingValue.toFixed(2)} [Source: ${req.pricingSource}]`);
        console.log(`   Items: ${req.itemCount} (${req.itemsWithPricing} with pricing)`);
        console.log(`   Has Adjudication: ${req.hasAdjudication ? 'YES' : 'NO'}`);

        if (req.pricingValue === 0 || !req.hasVendorName || !req.hasVendorCode) {
            console.log(`   ⚠️  ISSUES: ${[
                req.pricingValue === 0 ? 'No pricing' : null,
                !req.hasVendorName ? 'No vendor' : null,
                !req.hasVendorCode ? 'No vendor code' : null
            ].filter(Boolean).join(', ')}`);
        }
        console.log('');
    });

    console.log('\n========================================');
    console.log('SUMMARY STATISTICS');
    console.log('========================================\n');

    console.log(`Total Approved Requisitions: ${summary.total}`);
    console.log(`With Vendor Name: ${summary.withVendorName} (${(summary.withVendorName/summary.total*100).toFixed(1)}%)`);
    console.log(`With Vendor Code: ${summary.withVendorCode} (${(summary.withVendorCode/summary.total*100).toFixed(1)}%)`);
    console.log(`With Adjudication: ${summary.withAdjudication} (${(summary.withAdjudication/summary.total*100).toFixed(1)}%)`);
    console.log(`With Requisition Pricing: ${summary.withReqPricing} (${(summary.withReqPricing/summary.total*100).toFixed(1)}%)`);
    console.log(`With Item-level Pricing: ${summary.withItemPricing} (${(summary.withItemPricing/summary.total*100).toFixed(1)}%)`);
    console.log(`Fully Populated: ${summary.fullyPopulated} (${(summary.fullyPopulated/summary.total*100).toFixed(1)}%)`);

    if (summary.issues.length > 0) {
        console.log('\n========================================');
        console.log('REQUISITIONS WITH ISSUES');
        console.log('========================================\n');

        summary.issues.forEach(issue => {
            console.log(`${issue.req_number}: Missing ${issue.missing.join(', ')}`);
        });
    }

    console.log('\n========================================');
    console.log('ROOT CAUSE ANALYSIS');
    console.log('========================================\n');

    // Determine the root causes
    const causes = [];

    if (summary.withVendorCode < summary.total) {
        causes.push('Vendor codes not stored when adjudication is created');
    }
    if (summary.withItemPricing === 0 && summary.withReqPricing < summary.total) {
        causes.push('Pricing not transferred from adjudication to requisitions/items');
    }
    if (summary.withAdjudication === summary.total && summary.withReqPricing < summary.total) {
        causes.push('Adjudication data exists but not copied to requisition table');
    }

    causes.forEach((cause, index) => {
        console.log(`${index + 1}. ${cause}`);
    });

    console.log('\n========================================');
    console.log('RECOMMENDED SOLUTION');
    console.log('========================================\n');

    console.log('OPTION 1: Update Requisitions After Adjudication (RECOMMENDED)');
    console.log('  - When adjudication is approved, copy data to requisition table');
    console.log('  - Fields to update: selected_vendor, total_cost, vendor_currency');
    console.log('  - Add vendor_code field to requisitions table');
    console.log('  - Pros: Single source of truth, simple queries');
    console.log('  - Cons: Requires workflow update\n');

    console.log('OPTION 2: Update Items After Adjudication');
    console.log('  - When adjudication is approved, distribute amount to items');
    console.log('  - Calculate unit_price = total_amount / sum(quantities)');
    console.log('  - Pros: Item-level detail');
    console.log('  - Cons: More complex calculation\n');

    console.log('OPTION 3: Hybrid Approach (BEST)');
    console.log('  - Update both requisitions AND items tables');
    console.log('  - Requisition gets: vendor, vendor_code, total_cost, currency');
    console.log('  - Items get: unit_price, total_price calculated from adjudication');
    console.log('  - Pros: Complete data everywhere, works for all scenarios');
    console.log('  - Cons: More updates, but most reliable\n');

    console.log('========================================\n');

    db.close();
}
