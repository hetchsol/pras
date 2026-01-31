/**
 * Generate PDF for Board Room Table requisition to verify pricing fix
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

const reqNumber = 'KSB-OPE-JK-20251107083848';

console.log('\n========================================');
console.log('TESTING BOARD ROOM TABLE PDF');
console.log('========================================\n');

// Get requisition with full details including adjudication
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
    WHERE r.req_number = ?
`, [reqNumber], (err, requisition) => {
    if (err) {
        console.error('❌ ERROR fetching requisition:', err.message);
        db.close();
        return;
    }

    if (!requisition) {
        console.error('❌ No requisition found with number:', reqNumber);
        db.close();
        return;
    }

    console.log('✅ Fetched requisition:', requisition.req_number);
    console.log('   Status:', requisition.status);
    console.log('   Vendor:', requisition.approved_vendor);
    console.log('   Vendor Code:', requisition.vendor_code);
    console.log('   Recommended Amount:', requisition.recommended_amount);
    console.log('   Currency:', requisition.currency);

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
    `, [requisition.id], (err, items) => {
        if (err) {
            console.error('❌ ERROR fetching items:', err.message);
            db.close();
            return;
        }

        console.log('✅ Fetched', items.length, 'item(s)');
        items.forEach((item, index) => {
            console.log(`   Item ${index + 1}: ${item.item_name}`);
            console.log('     Quantity:', item.quantity);
            console.log('     Unit Price (from DB):', item.unit_price);
            console.log('     Total Price (from DB):', item.total_price);
        });

        // Calculate expected values
        const recommendedAmount = requisition.recommended_amount || 0;
        const expectedUnitPrice = items.length > 0 && items[0].quantity > 0 ? recommendedAmount / items[0].quantity : recommendedAmount;
        const expectedSubtotal = recommendedAmount;
        const expectedVAT = expectedSubtotal * 0.16;
        const expectedGrandTotal = expectedSubtotal + expectedVAT;

        console.log('\n💰 Expected Calculations:');
        console.log('   Recommended Amount:', recommendedAmount.toFixed(2));
        console.log('   Expected Unit Price:', expectedUnitPrice.toFixed(2));
        console.log('   Expected Subtotal:', expectedSubtotal.toFixed(2));
        console.log('   Expected VAT (16%):', expectedVAT.toFixed(2));
        console.log('   Expected Grand Total:', expectedGrandTotal.toFixed(2));

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
            const outputPath = path.join(__dirname, `BoardRoomTable_Fixed_${requisition.req_number}.pdf`);

            fs.writeFile(outputPath, pdfBuffer, (err) => {
                if (err) {
                    console.error('❌ ERROR saving PDF:', err.message);
                } else {
                    console.log('\n✅ PDF GENERATED SUCCESSFULLY!');
                    console.log('📁 Saved to:', outputPath);
                    console.log('\n========================================');
                    console.log('VERIFICATION CHECKLIST:');
                    console.log('========================================');
                    console.log('□ Vendor shows: AT Computers Limited');
                    console.log('□ Unit Price shows:', expectedUnitPrice.toFixed(2));
                    console.log('□ Amount shows:', recommendedAmount.toFixed(2));
                    console.log('□ Subtotal shows:', expectedSubtotal.toFixed(2));
                    console.log('□ VAT shows:', expectedVAT.toFixed(2));
                    console.log('□ Grand Total shows:', expectedGrandTotal.toFixed(2));
                    console.log('\n✨ Open the PDF file to verify all details!');
                    console.log('   Expected: Unit Price = 30000.00, Grand Total = 34800.00\n');
                }

                db.close();
            });
        });
    });
});
