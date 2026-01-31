const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./purchase_requisition.db');

console.log('🔍 Finding requisitions with po_number but no purchase_orders record...\n');

// Find requisitions that have po_number but no corresponding PO record
db.all(`
    SELECT r.*, v.name as vendor_name
    FROM requisitions r
    LEFT JOIN purchase_orders po ON po.requisition_id = r.id
    LEFT JOIN vendors v ON r.selected_vendor = v.id
    WHERE r.po_number IS NOT NULL
    AND po.id IS NULL
    ORDER BY r.id
`, [], (err, missingPOs) => {
    if (err) {
        console.error('Error finding missing POs:', err);
        db.close();
        return;
    }

    if (missingPOs.length === 0) {
        console.log('✅ No missing PO records found. All requisitions with po_number have corresponding purchase_orders records.');
        db.close();
        return;
    }

    console.log(`Found ${missingPOs.length} requisition(s) with missing PO records:\n`);

    let processed = 0;
    let errors = 0;

    missingPOs.forEach((req, index) => {
        console.log(`${index + 1}. Requisition ${req.req_number} (ID: ${req.id})`);
        console.log(`   PO Number: ${req.po_number}`);
        console.log(`   Status: ${req.status}`);

        // Calculate pricing breakdown
        const unitPrice = req.unit_price || 0;
        const quantity = req.quantity || 1;
        const subtotal = unitPrice * quantity;
        const vatRate = 16.0;
        const vatAmount = subtotal * (vatRate / 100);
        const grandTotal = subtotal + vatAmount;
        const currency = req.vendor_currency || 'ZMW';
        const selectedVendor = req.vendor_name || null;

        // Create the missing PO record
        db.run(`
            INSERT INTO purchase_orders (
                po_number, requisition_id, total_amount, status, generated_by,
                unit_price, quantity, subtotal, vat_rate, vat_amount, grand_total, currency, selected_vendor,
                created_at
            )
            VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.po_number,
            req.id,
            grandTotal,
            req.po_generated_by || req.md_approved_by || 1,
            unitPrice,
            quantity,
            subtotal,
            vatRate,
            vatAmount,
            grandTotal,
            currency,
            selectedVendor,
            req.po_generated_at || req.created_at
        ], function(err) {
            processed++;

            if (err) {
                console.log(`   ❌ Error: ${err.message}`);
                errors++;
            } else {
                console.log(`   ✅ Created PO record (ID: ${this.lastID})`);
                console.log(`      - Unit Price: ${unitPrice} ${currency}`);
                console.log(`      - Quantity: ${quantity}`);
                console.log(`      - Subtotal: ${subtotal.toFixed(2)} ${currency}`);
                console.log(`      - VAT (16%): ${vatAmount.toFixed(2)} ${currency}`);
                console.log(`      - Grand Total: ${grandTotal.toFixed(2)} ${currency}`);
                if (selectedVendor) {
                    console.log(`      - Vendor: ${selectedVendor}`);
                }
            }
            console.log('');

            // Close DB when all are processed
            if (processed === missingPOs.length) {
                console.log('\n' + '='.repeat(60));
                console.log(`✅ Migration complete!`);
                console.log(`   Total processed: ${processed}`);
                console.log(`   Successful: ${processed - errors}`);
                console.log(`   Errors: ${errors}`);
                console.log('='.repeat(60));
                db.close();
            }
        });
    });
});
