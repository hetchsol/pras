/**
 * Analyze database structure for PDF generation optimization
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

console.log('\n========================================');
console.log('DATABASE STRUCTURE ANALYSIS');
console.log('========================================\n');

// Get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log('📊 Tables in database:');
    tables.forEach(table => {
        console.log(`  • ${table.name}`);
    });

    // Analyze requisitions table
    console.log('\n\n📋 REQUISITIONS TABLE STRUCTURE:');
    console.log('='.repeat(50));
    db.all("PRAGMA table_info(requisitions)", [], (err, columns) => {
        columns.forEach(col => {
            console.log(`  ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
        });

        // Analyze requisition_items table
        console.log('\n\n📦 REQUISITION_ITEMS TABLE STRUCTURE:');
        console.log('='.repeat(50));
        db.all("PRAGMA table_info(requisition_items)", [], (err, columns) => {
            columns.forEach(col => {
                console.log(`  ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
            });

            // Analyze adjudications table
            console.log('\n\n💰 ADJUDICATIONS TABLE STRUCTURE:');
            console.log('='.repeat(50));
            db.all("PRAGMA table_info(adjudications)", [], (err, columns) => {
                columns.forEach(col => {
                    console.log(`  ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
                });

                // Analyze vendors table
                console.log('\n\n🏢 VENDORS TABLE STRUCTURE:');
                console.log('='.repeat(50));
                db.all("PRAGMA table_info(vendors)", [], (err, columns) => {
                    columns.forEach(col => {
                        console.log(`  ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
                    });

                    // Sample data analysis
                    console.log('\n\n📊 DATA ANALYSIS:');
                    console.log('='.repeat(50));

                    // Check requisitions with pricing data
                    db.get(`
                        SELECT
                            COUNT(*) as total,
                            SUM(CASE WHEN unit_price > 0 THEN 1 ELSE 0 END) as with_unit_price,
                            SUM(CASE WHEN total_cost > 0 THEN 1 ELSE 0 END) as with_total_cost,
                            SUM(CASE WHEN selected_vendor IS NOT NULL THEN 1 ELSE 0 END) as with_vendor
                        FROM requisitions
                        WHERE status = 'approved' OR status = 'completed'
                    `, [], (err, stats) => {
                        console.log('\nApproved/Completed Requisitions:');
                        console.log(`  Total: ${stats.total}`);
                        console.log(`  With unit_price: ${stats.with_unit_price} (${((stats.with_unit_price/stats.total)*100).toFixed(1)}%)`);
                        console.log(`  With total_cost: ${stats.with_total_cost} (${((stats.with_total_cost/stats.total)*100).toFixed(1)}%)`);
                        console.log(`  With vendor: ${stats.with_vendor} (${((stats.with_vendor/stats.total)*100).toFixed(1)}%)`);

                        // Check requisition_items with pricing
                        db.get(`
                            SELECT
                                COUNT(*) as total,
                                SUM(CASE WHEN unit_price > 0 THEN 1 ELSE 0 END) as with_unit_price,
                                SUM(CASE WHEN total_price > 0 THEN 1 ELSE 0 END) as with_total_price
                            FROM requisition_items ri
                            JOIN requisitions r ON ri.requisition_id = r.id
                            WHERE r.status = 'approved' OR r.status = 'completed'
                        `, [], (err, itemStats) => {
                            console.log('\nRequisition Items (for approved requisitions):');
                            console.log(`  Total items: ${itemStats.total}`);
                            console.log(`  With unit_price: ${itemStats.with_unit_price} (${((itemStats.with_unit_price/itemStats.total)*100).toFixed(1)}%)`);
                            console.log(`  With total_price: ${itemStats.with_total_price} (${((itemStats.with_total_price/itemStats.total)*100).toFixed(1)}%)`);

                            // Check adjudications
                            db.get(`
                                SELECT
                                    COUNT(*) as total,
                                    SUM(CASE WHEN recommended_amount > 0 THEN 1 ELSE 0 END) as with_amount,
                                    SUM(CASE WHEN recommended_vendor_id IS NOT NULL THEN 1 ELSE 0 END) as with_vendor_id,
                                    SUM(CASE WHEN recommended_vendor_name IS NOT NULL THEN 1 ELSE 0 END) as with_vendor_name
                                FROM adjudications
                            `, [], (err, adjStats) => {
                                console.log('\nAdjudications:');
                                console.log(`  Total: ${adjStats.total}`);
                                console.log(`  With recommended_amount: ${adjStats.with_amount} (${((adjStats.with_amount/adjStats.total)*100).toFixed(1)}%)`);
                                console.log(`  With vendor_id: ${adjStats.with_vendor_id} (${((adjStats.with_vendor_id/adjStats.total)*100).toFixed(1)}%)`);
                                console.log(`  With vendor_name: ${adjStats.with_vendor_name} (${((adjStats.with_vendor_name/adjStats.total)*100).toFixed(1)}%)`);

                                // Check data flow issues
                                console.log('\n\n⚠️  POTENTIAL ISSUES:');
                                console.log('='.repeat(50));

                                db.all(`
                                    SELECT
                                        r.id,
                                        r.req_number,
                                        r.status,
                                        r.unit_price as req_unit_price,
                                        r.total_cost as req_total_cost,
                                        r.selected_vendor,
                                        COUNT(ri.id) as item_count,
                                        SUM(CASE WHEN ri.unit_price > 0 THEN 1 ELSE 0 END) as items_with_price,
                                        a.recommended_amount,
                                        a.recommended_vendor_name
                                    FROM requisitions r
                                    LEFT JOIN requisition_items ri ON r.id = ri.requisition_id
                                    LEFT JOIN adjudications a ON r.id = a.requisition_id
                                    WHERE r.status IN ('approved', 'completed')
                                    GROUP BY r.id
                                    HAVING (r.unit_price = 0 OR r.unit_price IS NULL)
                                       AND (items_with_price = 0 OR items_with_price IS NULL)
                                       AND (a.recommended_amount IS NULL OR a.recommended_amount = 0)
                                    LIMIT 5
                                `, [], (err, problematic) => {
                                    if (problematic && problematic.length > 0) {
                                        console.log('\nRequisitions with NO pricing data anywhere:');
                                        problematic.forEach(req => {
                                            console.log(`  ⚠️  ${req.req_number} - Status: ${req.status}`);
                                            console.log(`      Items: ${req.item_count}, Vendor: ${req.selected_vendor || req.recommended_vendor_name || 'None'}`);
                                        });
                                    } else {
                                        console.log('\n✅ No requisitions found without pricing data');
                                    }

                                    // Recommendations
                                    console.log('\n\n💡 RECOMMENDATIONS:');
                                    console.log('='.repeat(50));

                                    generateRecommendations(stats, itemStats, adjStats);

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

function generateRecommendations(reqStats, itemStats, adjStats) {
    const issues = [];
    const recommendations = [];

    // Analyze where pricing data is stored
    const reqPricingPercent = (reqStats.with_total_cost / reqStats.total) * 100;
    const itemPricingPercent = (itemStats.with_total_price / itemStats.total) * 100;
    const adjPricingPercent = (adjStats.with_amount / adjStats.total) * 100;

    console.log('\n1. DATA CONSISTENCY:');
    if (reqPricingPercent < 50 && itemPricingPercent < 50 && adjPricingPercent > 50) {
        console.log('   ✅ PRIMARY: Use adjudications table (highest data availability)');
        console.log('   📝 RECOMMENDATION: Make adjudications table the single source of truth');
    } else if (itemPricingPercent > reqPricingPercent) {
        console.log('   ⚠️  Data split between items and adjudications');
        console.log('   📝 RECOMMENDATION: Consolidate pricing in one location');
    }

    console.log('\n2. DATABASE SCHEMA IMPROVEMENTS:');
    console.log('   📝 Option A: Add triggers to sync data automatically');
    console.log('   📝 Option B: Create a view that consolidates all pricing data');
    console.log('   📝 Option C: Add stored procedures for data consistency');

    console.log('\n3. APPLICATION WORKFLOW:');
    console.log('   📝 Ensure adjudication populates: recommended_amount, recommended_vendor_id/name');
    console.log('   📝 Update requisition_items with final approved pricing');
    console.log('   📝 Keep requisitions.total_cost as calculated aggregate');

    console.log('\n4. PDF GENERATOR STRATEGY (CURRENT):');
    console.log('   ✅ Priority 1: Use item-level pricing (unit_price × quantity)');
    console.log('   ✅ Priority 2: Use requisition.total_cost if items empty');
    console.log('   ✅ Priority 3: Use adjudication.recommended_amount as fallback');
    console.log('   ✅ Priority 4: Distribute adjudication amount across items');

    console.log('\n========================================\n');
}
