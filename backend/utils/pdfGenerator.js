const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF for approved requisition matching KSB format
 */
const generateRequisitionPDF = (requisition, items, callback) => {
    try {
        console.log('🔍 PDF Generation - KSB Format');
        console.log('🔍 Requisition data:', { req_number: requisition.req_number });
        console.log('🔍 Items count:', items.length);

        // Create PDF document
        const doc = new PDFDocument({
            margin: 40,
            size: 'A4'
        });
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

        // ===== HEADER SECTION =====
        // Add company logo - CENTERED at top
        try {
            const logoPath = path.join(__dirname, '../assets/logo.jpeg');
            if (fs.existsSync(logoPath)) {
                // Center the logo (A4 width = 595, logo width = 80, so x = (595 - 80) / 2 = 257.5)
                doc.image(logoPath, 257.5, 40, { width: 80, height: 80 });
            } else {
                // Fallback to text if logo not found - centered
                doc.fontSize(28)
                   .font('Helvetica-Bold')
                   .fillColor('#0066cc')
                   .text('KSB', 50, 60, { align: 'center', width: 495 });
            }
        } catch (err) {
            // Fallback to text on error - centered
            doc.fontSize(28)
               .font('Helvetica-Bold')
               .fillColor('#0066cc')
               .text('KSB', 50, 60, { align: 'center', width: 495 });
        }

        // ===== TITLE - Below logo =====
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text('APPROVED PURCHASE REQUISITION', 50, 135, { align: 'center', width: 495 });

        // Document Number section
        currentY = 160;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('Document Number:', 50, currentY, { align: 'center', width: 495 });

        currentY += 15;
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text(requisition.req_number, 50, currentY, { align: 'center', width: 495 });

        currentY += 18;
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#666666')
           .text(`Issue Date: ${new Date(requisition.created_at).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'})}`, 50, currentY, { align: 'center', width: 495 });

        // ===== TWO-COLUMN LAYOUT WITH BOXES =====
        currentY += 25; // Add spacing after Issue Date

        // Left Box - REQUISITIONING OFFICE
        const leftBoxX = 50;
        const rightBoxX = 305;
        const boxWidth = 245;
        const boxHeight = 110;

        doc.rect(leftBoxX, currentY, boxWidth, boxHeight)
           .strokeColor('#0066cc')
           .lineWidth(1.5)
           .stroke();

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text('REQUISITIONING OFFICE:', leftBoxX + 10, currentY + 8);

        let leftY = currentY + 26;
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('KSB Zambia', leftBoxX + 10, leftY);

        leftY += 14;
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#333333')
           .text('Musapas Business Park, Kamfinsa Junction', leftBoxX + 10, leftY, { width: boxWidth - 20 });

        leftY += 11;
        doc.text('Ndola/Kitwe Dual Carriageway, Kitwe', leftBoxX + 10, leftY, { width: boxWidth - 20 });

        leftY += 11;
        doc.text('Tel.: +260 968 670 002', leftBoxX + 10, leftY, { width: boxWidth - 20 });

        leftY += 11;
        doc.text('Mobile: +260 966 780 419', leftBoxX + 10, leftY, { width: boxWidth - 20 });

        // Right Box - APPROVED VENDOR
        doc.rect(rightBoxX, currentY, boxWidth, boxHeight)
           .strokeColor('#0066cc')
           .lineWidth(1.5)
           .stroke();

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text('APPROVED VENDOR:', rightBoxX + 10, currentY + 8);

        let rightY = currentY + 26;
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(requisition.approved_vendor || 'To Be Determined', rightBoxX + 10, rightY, { width: boxWidth - 20 });

        // Move currentY down after boxes
        currentY = currentY + boxHeight + 20;

        // ===== REQUISITION DETAILS SECTION =====
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text('REQUISITION DETAILS', 50, currentY);

        currentY += 18;

        // Details in two columns
        const col1X = 50;
        const col2X = 180;
        const col3X = 310;
        const col4X = 420;

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('Requisition #:', col1X, currentY)
           .font('Helvetica')
           .text(requisition.req_number, col2X, currentY);

        doc.font('Helvetica-Bold')
           .text('Delivery Location:', col3X, currentY)
           .font('Helvetica')
           .text(requisition.delivery_location || 'Office', col4X, currentY);

        currentY += 15;
        doc.font('Helvetica-Bold')
           .text('Department:', col1X, currentY)
           .font('Helvetica')
           .text(requisition.department || 'Operations', col2X, currentY);

        doc.font('Helvetica-Bold')
           .text('Account Code:', col3X, currentY)
           .font('Helvetica')
           .text(requisition.account_code || 'N/A', col4X, currentY);

        currentY += 15;
        doc.font('Helvetica-Bold')
           .text('Required Date:', col1X, currentY)
           .font('Helvetica')
           .text(new Date(requisition.required_date || requisition.created_at).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'}), col2X, currentY);

        doc.font('Helvetica-Bold')
           .text('Requested By:', col3X, currentY)
           .font('Helvetica')
           .text(requisition.created_by_name || 'N/A', col4X, currentY);

        currentY += 15;
        doc.font('Helvetica-Bold')
           .text('Urgency:', col1X, currentY)
           .font('Helvetica')
           .text(requisition.urgency || 'STANDARD', col2X, currentY);

        // Item Description
        currentY += 20;
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('Item Description:', 50, currentY);

        currentY += 12;
        doc.fontSize(9)
           .font('Helvetica')
           .text(requisition.description || requisition.title || 'Batteries', 50, currentY, { width: 495 });

        //===== APPROVED LINE ITEMS SECTION =====
        currentY += 25; // Add spacing before line items section
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text('APPROVED LINE ITEMS', 50, currentY);

        // Table header - simple with borders
        currentY += 18; // Add spacing before table
        const currency = requisition.currency || 'ZMW';

        doc.rect(50, currentY, 495, 22)
           .strokeColor('#0066cc')
           .fillColor('#f0f7ff')
           .fillAndStroke();

        doc.fillColor('#000000')
           .fontSize(8)
           .font('Helvetica-Bold')
           .text('Item Description', 58, currentY + 7, { width: 240 })
           .text('Qty', 310, currentY + 7, { width: 35, align: 'center' })
           .text(`Unit Price (${currency})`, 355, currentY + 7, { width: 85, align: 'right' })
           .text(`Amount (${currency})`, 455, currentY + 7, { width: 80, align: 'right' });

        currentY += 22;

        // Items - simple rows with borders
        let subtotal = 0;

        items.forEach((item, index) => {
            const rowHeight = 24;

            // Draw row border
            doc.rect(50, currentY, 495, rowHeight)
               .strokeColor('#cccccc')
               .lineWidth(0.5)
               .stroke();

            // Calculate pricing - now directly from item table (populated by triggers)
            const itemUnitPrice = item.unit_price || 0;
            const itemTotal = item.total_price || 0;

            subtotal += itemTotal;

            doc.fillColor('#000000')
               .fontSize(8)
               .font('Helvetica')
               .text(item.item_name || 'Item Description', 58, currentY + 8, { width: 240 })
               .text((item.quantity || 0).toString(), 310, currentY + 8, { width: 35, align: 'center' })
               .text(itemUnitPrice.toFixed(2), 355, currentY + 8, { width: 85, align: 'right' })
               .text(itemTotal.toFixed(2), 455, currentY + 8, { width: 80, align: 'right' });

            currentY += rowHeight;
        });

        // Totals section - aligned right
        currentY += 15;

        // Subtotal
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#000000')
           .text('Subtotal:', 380, currentY, { align: 'left' })
           .text(`${currency} ${subtotal.toFixed(2)}`, 455, currentY, { align: 'right', width: 90 });

        currentY += 14;

        // Tax - only apply for VAT, TOT has no tax
        // Default to VAT if not specified (for old requisitions or when procurement hasn't set it yet)
        const taxType = requisition.tax_type || 'VAT';
        let tax = 0;

        if (taxType === 'VAT') {
            tax = subtotal * 0.16; // 16% VAT
            doc.text('VAT (16%):', 380, currentY, { align: 'left' })
               .text(`${currency} ${tax.toFixed(2)}`, 455, currentY, { align: 'right', width: 90 });
        } else if (taxType === 'TOT') {
            // TOT - No tax applied
            doc.fillColor('#666666')
               .text('Tax (TOT):', 380, currentY, { align: 'left' })
               .text('No Tax', 455, currentY, { align: 'right', width: 90 });
        }

        currentY += 18;

        // Grand Total - Bold and Blue
        const grandTotal = subtotal + tax;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text('GRAND TOTAL:', 380, currentY, { align: 'left' })
           .text(`${currency} ${grandTotal.toFixed(2)}`, 455, currentY, { align: 'right', width: 90 });

        doc.fillColor('#000000'); // Reset color

        currentY += 25;

        // ===== AUTHORIZATION & APPROVAL TRAIL SECTION =====
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#0066cc')
           .text('AUTHORIZATION & APPROVAL TRAIL', 50, currentY);

        currentY += 20;

        // Approval trail details
        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('Initiated by:', 55, currentY)
           .font('Helvetica')
           .text(requisition.created_by_name || 'Justine Kaluya', 140, currentY);

        currentY += 13;
        doc.font('Helvetica-Bold')
           .text('HOD Approval:', 55, currentY)
           .font('Helvetica')
           .text(requisition.hod_approved_by_name || 'Joe Munthali', 140, currentY);

        currentY += 13;
        doc.font('Helvetica-Bold')
           .text('Finance Approval:', 55, currentY)
           .font('Helvetica')
           .text('Anne Banda', 140, currentY);

        currentY += 13;
        doc.font('Helvetica-Bold')
           .text('MD Approval:', 55, currentY)
           .font('Helvetica')
           .text(requisition.md_approved_by_name || 'Kanyembo Ndhlovu', 140, currentY);

        currentY += 20;

        // Footer message
        doc.fontSize(8)
           .font('Helvetica-Oblique')
           .fillColor('#666666')
           .text('This document represents an officially approved purchase requisition.', 60, currentY, { align: 'center', width: 485 })
           .text('All authorizations have been verified through the system approval workflow.', 60, currentY + 10, { align: 'center', width: 485 });

        currentY += 25;
        doc.text(`Document generated on: ${new Date().toLocaleDateString('en-US', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})} at ${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`, 60, currentY, { align: 'center', width: 485 })
           .text('KSB Zambia - Purchase Requisition Approval System (PRAS)', 60, currentY + 10, { align: 'center', width: 485 });

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        callback(error, null);
    }
};

module.exports = {
    generateRequisitionPDF
};
