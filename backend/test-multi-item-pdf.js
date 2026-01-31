const sqlite3 = require('sqlite3').verbose();
const { generateRequisitionPDF } = require('./utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('purchase_requisition.db');

console.log('\n=== Testing Multi-Item PDF Generation ===\n');

// Get latest requisition
db.get(`
  SELECT * FROM vw_requisition_pdf_data
  ORDER BY created_at DESC
  LIMIT 1
`, [], (err, requisition) => {
  if (err) {
    console.error('Error getting requisition:', err.message);
    db.close();
    return;
  }

  if (!requisition) {
    console.log('No requisitions found');
    db.close();
    return;
  }

  console.log(`Testing Requisition: ${requisition.req_number}`);
  console.log(`Description: ${requisition.description}`);

  // Get items
  db.all(`
    SELECT ri.*, v.name as vendor_name
    FROM requisition_items ri
    LEFT JOIN vendors v ON ri.vendor_id = v.id
    WHERE ri.requisition_id = ?
    ORDER BY ri.id
  `, [requisition.id], (err, items) => {
    if (err) {
      console.error('Error getting items:', err.message);
      db.close();
      return;
    }

    console.log(`\nFound ${items.length} items:`);
    items.forEach((item, idx) => {
      console.log(`\nItem ${idx + 1}:`);
      console.log(`  Name: ${item.item_name}`);
      console.log(`  Quantity: ${item.quantity}`);
      console.log(`  Unit Price: ${item.unit_price}`);
      console.log(`  Total: ${item.total_price}`);
    });

    // Calculate expected totals
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const vat = subtotal * 0.16;
    const grandTotal = subtotal + vat;

    console.log(`\nExpected Totals:`);
    console.log(`  Subtotal: ${subtotal.toFixed(2)}`);
    console.log(`  VAT (16%): ${vat.toFixed(2)}`);
    console.log(`  Grand Total: ${grandTotal.toFixed(2)}`);

    // Generate PDF
    console.log('\n📄 Generating PDF...');
    generateRequisitionPDF(requisition, items, (err, pdfBuffer) => {
      if (err) {
        console.error('❌ ERROR generating PDF:', err.message);
        console.error(err.stack);
        db.close();
        return;
      }

      // Save PDF
      const filename = `Test_Multi_Items_${requisition.req_number}.pdf`;
      fs.writeFileSync(filename, pdfBuffer);
      console.log(`\n✅ PDF generated successfully: ${filename}`);
      console.log(`\n📝 Please check the PDF to verify:`);
      console.log(`   1. All ${items.length} items are listed separately`);
      console.log(`   2. Each item has its own description, qty, unit price, amount`);
      console.log(`   3. Subtotal is sum of all items`);
      console.log(`   4. VAT is calculated on subtotal`);
      console.log(`   5. Grand Total = Subtotal + VAT`);

      db.close();
    });
  });
});
