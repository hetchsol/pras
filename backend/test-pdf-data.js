/**
 * Test script to verify PDF data query returns correct information
 * This simulates what the PDF endpoint does and shows the data
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database - try purchase_requisition.db first
const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

const reqId = 9; // Test with requisition ID 9

console.log('\n========================================');
console.log('PDF DATA VERIFICATION TEST');
console.log('========================================\n');

// Test the updated requisitions query
console.log('1️⃣  TESTING REQUISITION QUERY...\n');

db.get(`
    SELECT r.*,
           u.full_name as created_by_name,
           u.department,
           h.full_name as hod_approved_by_name,
           m.full_name as md_approved_by_name,
           COALESCE(a.recommended_vendor_name, r.selected_vendor) as approved_vendor,
           COALESCE(a.recommended_amount, r.total_cost) as recommended_amount,
           COALESCE(a.currency, r.vendor_currency, 'ZMW') as currency,
           v.code as vendor_code,
           v.email as vendor_email,
           v.phone as vendor_phone
    FROM requisitions r
    JOIN users u ON r.created_by = u.id
    LEFT JOIN users h ON r.hod_approved_by = h.id
    LEFT JOIN users m ON r.md_approved_by = m.id
    LEFT JOIN adjudications a ON r.id = a.requisition_id
    LEFT JOIN vendors v ON (v.id = a.recommended_vendor_id OR v.name = r.selected_vendor)
    WHERE r.id = ?
`, [reqId], (err, requisition) => {
    if (err) {
        console.error('❌ ERROR:', err.message);
        db.close();
        return;
    }

    if (!requisition) {
        console.error('❌ No requisition found with ID:', reqId);
        db.close();
        return;
    }

    console.log('✅ REQUISITION DATA:');
    console.log('-------------------');
    console.log('Requisition Number:', requisition.req_number);
    console.log('Status:', requisition.status);
    console.log('Created By:', requisition.created_by_name);
    console.log('Department:', requisition.department || 'N/A');
    console.log('\n📦 VENDOR INFORMATION:');
    console.log('-------------------');
    console.log('Approved Vendor:', requisition.approved_vendor || '❌ MISSING');
    console.log('Vendor Code:', requisition.vendor_code || '❌ MISSING');
    console.log('Vendor Email:', requisition.vendor_email || '❌ MISSING');
    console.log('Vendor Phone:', requisition.vendor_phone || '❌ MISSING');
    console.log('\n💰 FINANCIAL DATA:');
    console.log('-------------------');
    console.log('Currency:', requisition.currency);
    console.log('Recommended Amount:', requisition.recommended_amount || '❌ MISSING');

    // Test the updated items query
    console.log('\n\n2️⃣  TESTING ITEMS QUERY...\n');

    db.all(`
        SELECT ri.*,
               v.name as vendor_name,
               CASE
                   WHEN ri.unit_price IS NULL OR ri.unit_price = 0
                   THEN r.unit_price
                   ELSE ri.unit_price
               END as unit_price,
               CASE
                   WHEN ri.total_price IS NULL OR ri.total_price = 0
                   THEN r.total_cost
                   ELSE ri.total_price
               END as total_price,
               ri.quantity,
               ri.item_name,
               ri.specifications
        FROM requisition_items ri
        LEFT JOIN vendors v ON ri.vendor_id = v.id
        LEFT JOIN requisitions r ON ri.requisition_id = r.id
        WHERE ri.requisition_id = ?
        ORDER BY ri.id
    `, [reqId], (err, items) => {
        if (err) {
            console.error('❌ ERROR:', err.message);
            db.close();
            return;
        }

        console.log('✅ ITEMS DATA:');
        console.log('-------------------');

        if (items.length === 0) {
            console.log('⚠️  No items found');
        } else {
            let subtotal = 0;
            items.forEach((item, index) => {
                const itemTotal = item.total_price || ((item.quantity || 0) * (item.unit_price || 0));
                subtotal += itemTotal;

                console.log(`\nItem ${index + 1}:`);
                console.log('  Name:', item.item_name);
                console.log('  Quantity:', item.quantity);
                console.log('  Unit Price:', item.unit_price || '❌ MISSING');
                console.log('  Total Price:', itemTotal || '❌ MISSING');
                console.log('  Specifications:', item.specifications || 'None');
            });

            const vat = subtotal * 0.16;
            const grandTotal = subtotal + vat;

            console.log('\n\n💵 CALCULATED TOTALS:');
            console.log('-------------------');
            console.log('Subtotal:', subtotal.toFixed(2));
            console.log('VAT (16%):', vat.toFixed(2));
            console.log('Grand Total:', grandTotal.toFixed(2));
        }

        console.log('\n========================================');
        console.log('TEST COMPLETE');
        console.log('========================================\n');

        db.close();
    });
});
