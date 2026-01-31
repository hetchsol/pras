/**
 * Generate a test PDF to verify all changes are working
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Clear require cache for pdfGenerator
const pdfGenPath = require.resolve('./utils/pdfGenerator');
delete require.cache[pdfGenPath];
const { generateRequisitionPDF } = require('./utils/pdfGenerator');

// Connect to database
const dbPath = path.join(__dirname, 'purchase_requisition.db');
const db = new sqlite3.Database(dbPath);

const reqId = 9; // Test with requisition ID 9

console.log('\n========================================');
console.log('GENERATING TEST PDF');
console.log('========================================\n');

// Get requisition with full details
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
        console.error('❌ ERROR fetching requisition:', err.message);
        db.close();
        return;
    }

    if (!requisition) {
        console.error('❌ No requisition found with ID:', reqId);
        db.close();
        return;
    }

    console.log('✅ Fetched requisition:', requisition.req_number);
    console.log('   Vendor:', requisition.approved_vendor);
    console.log('   Vendor Code:', requisition.vendor_code);
    console.log('   Vendor Email:', requisition.vendor_email);
    console.log('   Vendor Phone:', requisition.vendor_phone);

    // Get items
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
            console.error('❌ ERROR fetching items:', err.message);
            db.close();
            return;
        }

        console.log('✅ Fetched', items.length, 'item(s)');

        let subtotal = 0;
        items.forEach((item, index) => {
            const itemTotal = item.total_price || ((item.quantity || 0) * (item.unit_price || 0));
            subtotal += itemTotal;
            console.log(`   Item ${index + 1}: ${item.item_name} - Unit Price: ${item.unit_price}, Total: ${itemTotal}`);
        });

        const vat = subtotal * 0.16;
        const grandTotal = subtotal + vat;

        console.log('\n💰 Totals:');
        console.log('   Subtotal:', subtotal.toFixed(2));
        console.log('   VAT (16%):', vat.toFixed(2));
        console.log('   Grand Total:', grandTotal.toFixed(2));

        // Generate PDF
        console.log('\n📄 Generating PDF...');

        generateRequisitionPDF(requisition, items, (err, pdfBuffer) => {
            if (err) {
                console.error('❌ ERROR generating PDF:', err.message);
                console.error(err.stack);
                db.close();
                return;
            }

            // Save PDF to file
            const outputPath = path.join(__dirname, `Test_Requisition_${requisition.req_number}.pdf`);

            fs.writeFile(outputPath, pdfBuffer, (err) => {
                if (err) {
                    console.error('❌ ERROR saving PDF:', err.message);
                } else {
                    console.log('\n✅ PDF GENERATED SUCCESSFULLY!');
                    console.log('📁 Saved to:', outputPath);
                    console.log('\n========================================');
                    console.log('VERIFICATION CHECKLIST:');
                    console.log('========================================');
                    console.log('□ Logo on RIGHT side');
                    console.log('□ Address on LEFT side');
                    console.log('□ "Approved Purchase Requisition" centered');
                    console.log('□ Vendor name shows:', requisition.approved_vendor);
                    console.log('□ Vendor code shows:', requisition.vendor_code);
                    console.log('□ Vendor email shows:', requisition.vendor_email);
                    console.log('□ Vendor phone shows:', requisition.vendor_phone);
                    console.log('□ Unit price shows:', items[0]?.unit_price);
                    console.log('□ Subtotal shows:', subtotal.toFixed(2));
                    console.log('□ VAT shows:', vat.toFixed(2));
                    console.log('□ Grand Total shows:', grandTotal.toFixed(2));
                    console.log('\n✨ Open the PDF file to verify all details!\n');
                }

                db.close();
            });
        });
    });
});
