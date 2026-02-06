const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to format date
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Helper function to format datetime
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper function to add header with logo
function addHeader(doc, title) {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');

  // Add logo if it exists
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 30, { width: 100 });
  }

  // Add company name and title
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .text('KINGS SEED & BOOKSHOP', 160, 40, { align: 'center' })
     .fontSize(16)
     .text(title, 160, 65, { align: 'center' })
     .moveDown(2);
}

// Helper function to add approval workflow section for Issue Slips
function addIssueSlipApprovalSection(doc, approvals, yPosition) {
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('APPROVAL WORKFLOW', 50, yPosition);
  yPosition += 20;

  // Draw box around approval section
  doc.rect(50, yPosition, 500, 120).stroke();
  yPosition += 15;

  // Find approvals by role
  const hodApproval = approvals.find(a => a.role === 'hod' && a.action !== 'pending');
  const financeApproval = approvals.find(a => a.role === 'finance' && a.action !== 'pending');

  // HOD Approval
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('HEAD OF DEPARTMENT:', 70, yPosition);
  yPosition += 15;
  if (hodApproval) {
    doc.font('Helvetica')
       .text(`Name: ${hodApproval.user_name || hodApproval.name || 'N/A'}`, 70, yPosition)
       .text(`Action: ${hodApproval.action ? hodApproval.action.toUpperCase() : 'N/A'}`, 250, yPosition)
       .text(`Date/Time: ${formatDateTime(hodApproval.timestamp || hodApproval.date)}`, 370, yPosition);
    yPosition += 12;
    if (hodApproval.comment || hodApproval.comments) {
      doc.text(`Comments: ${hodApproval.comment || hodApproval.comments}`, 70, yPosition, { width: 460 });
    }
  } else {
    doc.font('Helvetica').text('Pending', 70, yPosition);
  }
  yPosition += 25;
  doc.moveTo(70, yPosition).lineTo(530, yPosition).stroke();
  yPosition += 15;

  // Finance Approval
  doc.font('Helvetica-Bold');
  doc.text('FINANCE:', 70, yPosition);
  yPosition += 15;
  if (financeApproval) {
    doc.font('Helvetica')
       .text(`Name: ${financeApproval.user_name || financeApproval.name || 'N/A'}`, 70, yPosition)
       .text(`Action: ${financeApproval.action ? financeApproval.action.toUpperCase() : 'N/A'}`, 250, yPosition)
       .text(`Date/Time: ${formatDateTime(financeApproval.timestamp || financeApproval.date)}`, 370, yPosition);
    yPosition += 12;
    if (financeApproval.comment || financeApproval.comments) {
      doc.text(`Comments: ${financeApproval.comment || financeApproval.comments}`, 70, yPosition, { width: 460 });
    }
  } else {
    doc.font('Helvetica').text('Pending', 70, yPosition);
  }

  return yPosition + 40;
}

// Generate Issue Slip PDF
async function generateIssueSlipPDF(slip, items, approvals, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      addHeader(doc, 'ISSUE SLIP');

      // Slip ID and Status
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text(`Slip ID: ${slip.id}`, 50, 120)
         .text(`Status: ${slip.status.replace(/_/g, ' ').toUpperCase()}`, 400, 120, { align: 'right' })
         .moveDown();

      // Draw info section
      let yPos = 150;

      // Left column
      doc.font('Helvetica-Bold').text('Issue Date:', 50, yPos);
      doc.font('Helvetica').text(formatDate(slip.issue_date || slip.created_at), 150, yPos);

      doc.font('Helvetica-Bold').text('Issued To:', 50, yPos + 20);
      doc.font('Helvetica').text(slip.issued_to || 'N/A', 150, yPos + 20);

      doc.font('Helvetica-Bold').text('Department:', 50, yPos + 40);
      doc.font('Helvetica').text(slip.department || slip.initiator_department || 'N/A', 150, yPos + 40);

      doc.font('Helvetica-Bold').text('Delivery Location:', 50, yPos + 60);
      doc.font('Helvetica').text(slip.delivery_location || 'N/A', 150, yPos + 60);

      // Right column
      doc.font('Helvetica-Bold').text('Delivery Date:', 300, yPos);
      doc.font('Helvetica').text(formatDate(slip.delivery_date), 400, yPos);

      doc.font('Helvetica-Bold').text('Delivered By:', 300, yPos + 20);
      doc.font('Helvetica').text(slip.delivered_by || 'N/A', 400, yPos + 20);

      doc.font('Helvetica-Bold').text('Reference No:', 300, yPos + 40);
      doc.font('Helvetica').text(slip.reference_number || 'N/A', 400, yPos + 40);

      doc.font('Helvetica-Bold').text('Created By:', 300, yPos + 60);
      doc.font('Helvetica').text(slip.initiator_name || 'N/A', 400, yPos + 60);

      // Remarks
      yPos += 90;
      if (slip.remarks) {
        doc.font('Helvetica-Bold').text('Remarks:', 50, yPos);
        doc.font('Helvetica').text(slip.remarks, 120, yPos, { width: 430 });
        yPos += 30;
      }

      // Items table
      yPos += 20;
      doc.font('Helvetica-Bold').fontSize(12).text('ITEMS', 50, yPos);
      yPos += 20;

      // Table headers
      const tableHeaders = ['#', 'Item Code', 'Item Name', 'Description', 'Qty', 'Unit'];
      const colWidths = [30, 70, 120, 150, 50, 60];
      let xPos = 50;

      // Draw header row
      doc.rect(50, yPos, 500, 20).fill('#f0f0f0').stroke();
      doc.fillColor('black').fontSize(9).font('Helvetica-Bold');

      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos + 3, yPos + 5, { width: colWidths[i] - 6, align: 'left' });
        xPos += colWidths[i];
      });
      yPos += 20;

      // Draw item rows
      doc.font('Helvetica').fontSize(9);
      items.forEach((item, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        xPos = 50;
        doc.rect(50, yPos, 500, 20).stroke();

        const rowData = [
          (index + 1).toString(),
          item.item_code || '-',
          item.item_name || '-',
          item.description || '-',
          item.quantity.toString(),
          item.unit || 'pcs'
        ];

        rowData.forEach((data, i) => {
          doc.text(data, xPos + 3, yPos + 5, { width: colWidths[i] - 6, align: 'left' });
          xPos += colWidths[i];
        });
        yPos += 20;
      });

      // Add approval section
      yPos += 30;
      if (yPos > 550) {
        doc.addPage();
        yPos = 50;
      }
      yPos = addIssueSlipApprovalSection(doc, approvals, yPos);

      // Collected By section
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }
      yPos += 10;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Collected By:', 50, yPos);
      doc.font('Helvetica').text('_______________________', 50, yPos + 25);
      doc.font('Helvetica-Bold').text('Name', 50, yPos + 42);

      doc.text('Signature:', 250, yPos);
      doc.font('Helvetica').text('_______________________', 250, yPos + 25);

      doc.font('Helvetica-Bold').text('Date:', 430, yPos);
      doc.font('Helvetica').text('_______________', 430, yPos + 25);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Generate Picking Slip PDF
async function generatePickingSlipPDF(slip, items, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      addHeader(doc, 'PICKING SLIP');

      // Slip ID and Status
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text(`Slip ID: ${slip.id}`, 50, 120)
         .text(`Status: ${slip.status.replace(/_/g, ' ').toUpperCase()}`, 400, 120, { align: 'right' })
         .moveDown();

      // Draw info section
      let yPos = 150;

      // Left column
      doc.font('Helvetica-Bold').text('Pick Date:', 50, yPos);
      doc.font('Helvetica').text(formatDate(slip.pick_date || slip.created_at), 150, yPos);

      doc.font('Helvetica-Bold').text('Picked By:', 50, yPos + 20);
      doc.font('Helvetica').text(slip.picked_by || 'N/A', 150, yPos + 20);

      doc.font('Helvetica-Bold').text('Department:', 50, yPos + 40);
      doc.font('Helvetica').text(slip.department || slip.initiator_department || 'N/A', 150, yPos + 40);

      // Right column
      doc.font('Helvetica-Bold').text('Destination:', 300, yPos);
      doc.font('Helvetica').text(slip.destination || 'N/A', 400, yPos);

      doc.font('Helvetica-Bold').text('Reference No:', 300, yPos + 20);
      doc.font('Helvetica').text(slip.reference_number || 'N/A', 400, yPos + 20);

      doc.font('Helvetica-Bold').text('Created By:', 300, yPos + 40);
      doc.font('Helvetica').text(slip.initiator_name || 'N/A', 400, yPos + 40);

      // Remarks
      yPos += 70;
      if (slip.remarks) {
        doc.font('Helvetica-Bold').text('Remarks:', 50, yPos);
        doc.font('Helvetica').text(slip.remarks, 120, yPos, { width: 430 });
        yPos += 30;
      }

      // Items table
      yPos += 20;
      doc.font('Helvetica-Bold').fontSize(12).text('ITEMS', 50, yPos);
      yPos += 20;

      // Table headers
      const tableHeaders = ['#', 'Item Code', 'Item Name', 'Description', 'Qty', 'Unit'];
      const colWidths = [30, 70, 120, 150, 50, 60];
      let xPos = 50;

      // Draw header row
      doc.rect(50, yPos, 500, 20).fill('#f0f0f0').stroke();
      doc.fillColor('black').fontSize(9).font('Helvetica-Bold');

      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos + 3, yPos + 5, { width: colWidths[i] - 6, align: 'left' });
        xPos += colWidths[i];
      });
      yPos += 20;

      // Draw item rows
      doc.font('Helvetica').fontSize(9);
      items.forEach((item, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        xPos = 50;
        doc.rect(50, yPos, 500, 20).stroke();

        const rowData = [
          (index + 1).toString(),
          item.item_code || '-',
          item.item_name || '-',
          item.description || '-',
          item.quantity.toString(),
          item.unit || 'pcs'
        ];

        rowData.forEach((data, i) => {
          doc.text(data, xPos + 3, yPos + 5, { width: colWidths[i] - 6, align: 'left' });
          xPos += colWidths[i];
        });
        yPos += 20;
      });

      // Add signature section
      yPos += 40;
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Prepared By:', 50, yPos);
      doc.font('Helvetica').text(slip.initiator_name || 'N/A', 130, yPos);
      doc.text('_______________________', 50, yPos + 30);

      doc.font('Helvetica-Bold').text('Received By:', 300, yPos);
      doc.text('_______________________', 300, yPos + 30);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateIssueSlipPDF,
  generatePickingSlipPDF
};
