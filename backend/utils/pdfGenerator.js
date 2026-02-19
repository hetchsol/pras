const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to add APPROVED/DECLINED stamp (no border, bold text)
function addStatusStamp(doc, status) {
  const s = (status || '').toLowerCase().replace(/_/g, ' ');
  let stampText, stampColor;

  if (s.includes('approved') || s === 'completed') {
    stampText = 'APPROVED';
    stampColor = '#008000';
  } else if (s.includes('rejected') || s.includes('declined')) {
    stampText = 'DECLINED';
    stampColor = '#CC0000';
  } else {
    return;
  }

  doc.save();
  doc.fontSize(40).font('Helvetica-Bold')
     .fillColor(stampColor).fillOpacity(0.3)
     .text(stampText, 350, 680);
  doc.restore();
  doc.fillOpacity(1).fillColor('#000000');
}

/**
 * Generate PDF for approved requisition
 */
const generateRequisitionPDF = (requisition, items, callback) => {
    try {
        console.log('🔍 PDF Generation - Using UPDATED version with centered title');
        console.log('🔍 Requisition data:', { req_number: requisition.req_number, approved_vendor: requisition.approved_vendor });
        console.log('🔍 Items count:', items.length);

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        // Collect PDF data
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            callback(null, pdfBuffer);
        });
        doc.on('error', (err) => {
            callback(err, null);
        });

        // Add logo
        const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 30, { width: 100 });
        }

        // Add company header
        doc.fontSize(20)
           .text('APPROVED PURCHASE REQUISITION', 160, 35, { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(12)
           .text('KSB Zambia Limited', { align: 'center' })
           .fontSize(10)
           .text('Purchase Requisition Approval System (PRAS)', { align: 'center' })
           .moveDown(0.5);

        // Document Number (centered)
        doc.fontSize(12)
           .fillColor('#0066CC')
           .text(`Document No: ${requisition.req_number}`, { align: 'center' })
           .fillColor('#000000')
           .moveDown(1);

        // Add status stamp
        addStatusStamp(doc, requisition.status);

        // Add requisition details box
        const boxTop = doc.y;
        doc.rect(50, boxTop, 495, 140)
           .stroke();

        doc.fontSize(11)
           .text(`Date Created: ${new Date(requisition.created_at).toLocaleDateString()}`, 60, boxTop + 10)
           .text(`Requested By: ${requisition.created_by_name}`, 60, boxTop + 30)
           .text(`Department: ${requisition.department || 'N/A'}`, 60, boxTop + 50)
           .text(`Urgency: ${requisition.urgency || 'Medium'}`, 60, boxTop + 70)
           .text(`Approved Vendor: ${requisition.approved_vendor || 'TBD'}`, 60, boxTop + 90)
           .text(`Delivery Location: ${requisition.delivery_location || 'N/A'}`, 60, boxTop + 110);

        doc.text(`Required Date: ${requisition.required_date ? new Date(requisition.required_date).toLocaleDateString() : 'N/A'}`, 320, boxTop + 10)
           .text(`Status: ${requisition.status.toUpperCase()}`, 320, boxTop + 30)
           .text(`Account Code: ${requisition.account_code || 'N/A'}`, 320, boxTop + 50)
           .text(`Approved Date: ${requisition.md_approved_at ? new Date(requisition.md_approved_at).toLocaleDateString() : 'Pending'}`, 320, boxTop + 70);

        doc.moveDown(9);

        // Add description if available
        if (requisition.description) {
            doc.fontSize(11)
               .text('Description:', { underline: true })
               .fontSize(10)
               .text(requisition.description, { width: 495 })
               .moveDown(1);
        }

        // Add items table
        doc.fontSize(12)
           .text('Items:', { underline: true })
           .moveDown(0.5);

        // Table header
        const tableTop = doc.y;
        doc.fontSize(10)
           .fillColor('#000000');

        // Draw table header
        doc.rect(50, tableTop, 495, 20).fillAndStroke('#CCCCCC', '#000000');
        doc.fillColor('#000000')
           .text('Item Code', 55, tableTop + 5, { width: 50 })
           .text('Description', 108, tableTop + 5, { width: 180 })
           .text('Qty', 293, tableTop + 5, { width: 30 })
           .text('Unit Price', 328, tableTop + 5, { width: 60 })
           .text('Total', 393, tableTop + 5, { width: 60 })
           .text('Vendor', 458, tableTop + 5, { width: 82 });

        // Draw items and calculate totals
        let yPos = tableTop + 20;
        let rowColor = true;
        let subtotal = 0;

        items.forEach((item, index) => {
            // Alternate row colors
            if (rowColor) {
                doc.rect(50, yPos, 495, 25).fillAndStroke('#F5F5F5', '#CCCCCC');
            } else {
                doc.rect(50, yPos, 495, 25).stroke('#CCCCCC');
            }
            rowColor = !rowColor;

            const itemTotal = (item.quantity || 0) * (item.unit_price || 0);
            subtotal += itemTotal;

            doc.fillColor('#000000')
               .text(item.item_code || '-', 55, yPos + 5, { width: 50, ellipsis: true })
               .text(item.item_name || 'N/A', 108, yPos + 5, { width: 180, ellipsis: true })
               .text((item.quantity || 0).toString(), 293, yPos + 5, { width: 30 })
               .text(`K${(item.unit_price || 0).toFixed(2)}`, 328, yPos + 5, { width: 60 })
               .text(`K${itemTotal.toFixed(2)}`, 393, yPos + 5, { width: 60 })
               .text(item.vendor_name || requisition.approved_vendor || 'TBD', 458, yPos + 5, { width: 82, ellipsis: true });

            yPos += 25;
        });

        // Add subtotal, VAT, and grand total
        doc.rect(50, yPos, 495, 20).fillAndStroke('#F0F0F0', '#CCCCCC');
        doc.fontSize(10)
           .fillColor('#000000')
           .text('SUBTOTAL:', 328, yPos + 5, { width: 60 })
           .text(`K${subtotal.toFixed(2)}`, 393, yPos + 5, { width: 60 });

        yPos += 20;

        const vat = subtotal * 0.16; // 16% VAT
        doc.rect(50, yPos, 495, 20).fillAndStroke('#F0F0F0', '#CCCCCC');
        doc.text('VAT (16%):', 328, yPos + 5, { width: 60 })
           .text(`K${vat.toFixed(2)}`, 393, yPos + 5, { width: 60 });

        yPos += 20;

        const grandTotal = subtotal + vat;
        doc.rect(50, yPos, 495, 25).fillAndStroke('#E0E0E0', '#000000');
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('GRAND TOTAL:', 328, yPos + 5, { width: 60 })
           .text(`K${grandTotal.toFixed(2)}`, 393, yPos + 5, { width: 60 });

        yPos += 35;
        doc.font('Helvetica');
        doc.y = yPos;

        // Add approval section
        if (requisition.hod_approved_by) {
            doc.moveDown(1)
               .fontSize(11)
               .text('Approval Details:', { underline: true })
               .moveDown(0.5)
               .fontSize(10)
               .text(`Approved By: ${requisition.hod_approved_by_name || 'N/A'}`)
               .text(`Approval Date: ${requisition.hod_approved_at ? new Date(requisition.hod_approved_at).toLocaleString() : 'N/A'}`)
               .text(`Comments: ${requisition.hod_comments || 'No comments'}`)
               .moveDown(1);
        }

        // Add procurement details if available
        if (requisition.procurement_status === 'completed') {
            doc.fontSize(11)
               .text('Procurement Details:', { underline: true })
               .moveDown(0.5)
               .fontSize(10)
               .text(`Completed Date: ${requisition.procurement_completed_at ? new Date(requisition.procurement_completed_at).toLocaleString() : 'N/A'}`)
               .text(`Comments: ${requisition.procurement_comments || 'No comments'}`)
               .moveDown(1);
        }

        // Add footer
        const pageHeight = doc.page.height;
        doc.fontSize(8)
           .text(
               `Generated on ${new Date().toLocaleString()} | KSB Purchase Requisition Approval System (PRAS)`,
               50,
               pageHeight - 50,
               { align: 'center', width: 495 }
           );

        // Finalize PDF
        doc.end();

    } catch (error) {
        callback(error, null);
    }
};

module.exports = {
    generateRequisitionPDF
};
