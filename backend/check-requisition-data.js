/**
 * Check data for specific requisition to debug pricing issues
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

const reqNumber = 'KSB-OPE-JK-20251107083848';

console.log('\n========================================');
console.log('CHECKING REQUISITION DATA');
console.log('========================================\n');

// Get requisition basic data
db.get(`
    SELECT * FROM requisitions WHERE req_number = ?
`, [reqNumber], (err, req) => {
    if (err) {
        console.error('❌ ERROR:', err.message);
        db.close();
        return;
    }

    if (!req) {
        console.error('❌ No requisition found with number:', reqNumber);
        db.close();
        return;
    }

    console.log('📋 REQUISITION DATA:');
    console.log('-------------------');
    console.log('ID:', req.id);
    console.log('Req Number:', req.req_number);
    console.log('Status:', req.status);
    console.log('Selected Vendor:', req.selected_vendor);
    console.log('Unit Price:', req.unit_price);
    console.log('Total Cost:', req.total_cost);
    console.log('Vendor Currency:', req.vendor_currency);
    console.log('Description:', req.description);

    // Get items
    db.all(`
        SELECT * FROM requisition_items WHERE requisition_id = ?
    `, [req.id], (err, items) => {
        if (err) {
            console.error('❌ ERROR:', err.message);
            db.close();
            return;
        }

        console.log('\n📦 ITEMS DATA:');
        console.log('-------------------');
        console.log('Number of items:', items.length);

        items.forEach((item, index) => {
            console.log(`\nItem ${index + 1}:`);
            console.log('  ID:', item.id);
            console.log('  Name:', item.item_name);
            console.log('  Quantity:', item.quantity);
            console.log('  Unit Price:', item.unit_price);
            console.log('  Total Price:', item.total_price);
            console.log('  Specifications:', item.specifications);
        });

        // Get adjudication
        db.get(`
            SELECT * FROM adjudications WHERE requisition_id = ?
        `, [req.id], (err, adj) => {
            if (err) {
                console.error('❌ ERROR:', err.message);
                db.close();
                return;
            }

            console.log('\n💰 ADJUDICATION DATA:');
            console.log('-------------------');
            if (adj) {
                console.log('Recommended Vendor ID:', adj.recommended_vendor_id);
                console.log('Recommended Vendor Name:', adj.recommended_vendor_name);
                console.log('Recommended Amount:', adj.recommended_amount);
                console.log('Currency:', adj.currency);
            } else {
                console.log('⚠️  No adjudication record found');
            }

            // Get vendor by name if selected_vendor exists
            if (req.selected_vendor) {
                db.get(`
                    SELECT * FROM vendors WHERE name = ?
                `, [req.selected_vendor], (err, vendor) => {
                    console.log('\n🏢 VENDOR DATA (by name):');
                    console.log('-------------------');
                    if (vendor) {
                        console.log('ID:', vendor.id);
                        console.log('Name:', vendor.name);
                        console.log('Code:', vendor.code);
                        console.log('Email:', vendor.email);
                        console.log('Phone:', vendor.phone);
                    } else {
                        console.log('⚠️  No vendor found with name:', req.selected_vendor);
                    }

                    console.log('\n========================================\n');
                    db.close();
                });
            } else {
                console.log('\n========================================\n');
                db.close();
            }
        });
    });
});
