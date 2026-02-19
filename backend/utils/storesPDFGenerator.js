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
    minute: '2-digit',
    second: '2-digit'
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
     .text('KSB ZAMBIA LIMITED', 160, 40, { align: 'center' })
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
  doc.fontSize(10).font('Helvetica-Bold').fillColor('black');
  doc.text('HEAD OF DEPARTMENT:', 70, yPosition);
  yPosition += 15;
  if (hodApproval) {
    doc.font('Helvetica').fillColor('#000000')
       .text('Name: ', 70, yPosition, { continued: true }).fillColor('#0000CC').text(hodApproval.user_name || hodApproval.name || 'N/A');
    doc.fillColor('#000000').text('Action: ', 250, yPosition, { continued: true }).fillColor('#0000CC').text(hodApproval.action ? hodApproval.action.toUpperCase() : 'N/A');
    doc.fillColor('#000000').text('Date/Time: ', 370, yPosition, { continued: true }).fillColor('#0000CC').text(formatDateTime(hodApproval.timestamp || hodApproval.date));
    yPosition += 12;
    if (hodApproval.comment || hodApproval.comments) {
      doc.fillColor('black').text(`Comments: ${hodApproval.comment || hodApproval.comments}`, 70, yPosition, { width: 460 });
    }
  } else {
    doc.font('Helvetica').fillColor('black').text('Pending', 70, yPosition);
  }
  yPosition += 25;
  doc.fillColor('black');
  doc.moveTo(70, yPosition).lineTo(530, yPosition).stroke();
  yPosition += 15;

  // Finance Approval
  doc.font('Helvetica-Bold').fillColor('black');
  doc.text('FINANCE MANAGER:', 70, yPosition);
  yPosition += 15;
  if (financeApproval) {
    doc.font('Helvetica').fillColor('#000000')
       .text('Name: ', 70, yPosition, { continued: true }).fillColor('#0000CC').text(financeApproval.user_name || financeApproval.name || 'N/A');
    doc.fillColor('#000000').text('Action: ', 250, yPosition, { continued: true }).fillColor('#0000CC').text(financeApproval.action ? financeApproval.action.toUpperCase() : 'N/A');
    doc.fillColor('#000000').text('Date/Time: ', 370, yPosition, { continued: true }).fillColor('#0000CC').text(formatDateTime(financeApproval.timestamp || financeApproval.date));
    yPosition += 12;
    if (financeApproval.comment || financeApproval.comments) {
      doc.fillColor('black').text(`Comments: ${financeApproval.comment || financeApproval.comments}`, 70, yPosition, { width: 460 });
    }
  } else {
    doc.font('Helvetica').fillColor('black').text('Pending', 70, yPosition);
  }
  doc.fillColor('black');

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

      // Slip ID and Status (labels black, values blue)
      const statusText = slip.status.replace(/_/g, ' ').toUpperCase();
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#000000').text('Slip ID: ', 50, 120, { continued: true }).fillColor('#0000CC').text(slip.id);
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#000000').text('Status: ', 400, 120, { continued: true, align: 'right' }).fillColor('#0000CC').text(statusText);
      doc.fillColor('black').moveDown();

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

      // Customer
      if (slip.customer) {
        doc.font('Helvetica-Bold').text('Customer:', 50, yPos + 80);
        doc.font('Helvetica').text(slip.customer, 150, yPos + 80);
      }

      // Remarks
      yPos += slip.customer ? 110 : 90;
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
      const tableHeaders = ['#', 'Item Code', 'Description', 'Qty', 'Unit'];
      const colWidths = [30, 80, 260, 60, 70];
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
          item.description || item.item_name || '-',
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

      // Slip ID and Status (labels black, values blue)
      const statusText2 = slip.status.replace(/_/g, ' ').toUpperCase();
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#000000').text('Slip ID: ', 50, 120, { continued: true }).fillColor('#0000CC').text(slip.id);
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#000000').text('Status: ', 400, 120, { continued: true, align: 'right' }).fillColor('#0000CC').text(statusText2);
      doc.fillColor('black').moveDown();

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

      doc.font('Helvetica-Bold').text('Delivery Location:', 300, yPos + 20);
      doc.font('Helvetica').text(slip.delivery_location || 'N/A', 400, yPos + 20);

      doc.font('Helvetica-Bold').text('Reference No:', 300, yPos + 40);
      doc.font('Helvetica').text(slip.reference_number || 'N/A', 400, yPos + 40);

      doc.font('Helvetica-Bold').text('Created By:', 300, yPos + 60);
      doc.font('Helvetica').text(slip.initiator_name || 'N/A', 400, yPos + 60);

      // Customer
      if (slip.customer) {
        doc.font('Helvetica-Bold').text('Customer:', 50, yPos + 60);
        doc.font('Helvetica').text(slip.customer, 150, yPos + 60);
      }

      // Remarks
      yPos += slip.customer ? 100 : 90;
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
      const tableHeaders2 = ['#', 'Item Code', 'Description', 'Qty', 'Unit'];
      const colWidths2 = [30, 80, 260, 60, 70];
      let xPos = 50;

      // Draw header row
      doc.rect(50, yPos, 500, 20).fill('#f0f0f0').stroke();
      doc.fillColor('black').fontSize(9).font('Helvetica-Bold');

      tableHeaders2.forEach((header, i) => {
        doc.text(header, xPos + 3, yPos + 5, { width: colWidths2[i] - 6, align: 'left' });
        xPos += colWidths2[i];
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
          item.description || item.item_name || '-',
          item.quantity.toString(),
          item.unit || 'pcs'
        ];

        rowData.forEach((data, i) => {
          doc.text(data, xPos + 3, yPos + 5, { width: colWidths2[i] - 6, align: 'left' });
          xPos += colWidths2[i];
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

// Generate GRN PDF
async function generateGRNPDF(grn, items, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      addHeader(doc, 'GOODS RECEIPT NOTE');

      // GRN ID and Status (labels black, values blue)
      const statusText = grn.status.replace(/_/g, ' ').toUpperCase();
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#000000').text('GRN ID: ', 50, 120, { continued: true }).fillColor('#0000CC').text(grn.id);
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#000000').text('Status: ', 400, 120, { continued: true, align: 'right' }).fillColor('#0000CC').text(statusText);
      doc.fillColor('black').moveDown();

      // Draw info section
      let yPos = 150;

      // Left column
      doc.font('Helvetica-Bold').text('Receipt Date:', 50, yPos);
      doc.font('Helvetica').text(formatDate(grn.receipt_date || grn.created_at), 160, yPos);

      doc.font('Helvetica-Bold').text('PR Reference:', 50, yPos + 20);
      doc.font('Helvetica').text(grn.pr_id || 'N/A', 160, yPos + 20);

      doc.font('Helvetica-Bold').text('Supplier:', 50, yPos + 40);
      doc.font('Helvetica').text(grn.supplier || 'N/A', 160, yPos + 40);

      doc.font('Helvetica-Bold').text('Department:', 50, yPos + 60);
      doc.font('Helvetica').text(grn.department || 'N/A', 160, yPos + 60);

      // Right column
      doc.font('Helvetica-Bold').text('Received By:', 300, yPos);
      doc.font('Helvetica').text(grn.received_by || 'N/A', 410, yPos);

      doc.font('Helvetica-Bold').text('Delivery Note #:', 300, yPos + 20);
      doc.font('Helvetica').text(grn.delivery_note_number || 'N/A', 410, yPos + 20);

      doc.font('Helvetica-Bold').text('Invoice #:', 300, yPos + 40);
      doc.font('Helvetica').text(grn.invoice_number || 'N/A', 410, yPos + 40);

      doc.font('Helvetica-Bold').text('Created By:', 300, yPos + 60);
      doc.font('Helvetica').text(grn.initiator_name || 'N/A', 410, yPos + 60);

      yPos += 90;

      // Customer reservation (amber highlight if present)
      if (grn.customer) {
        doc.rect(50, yPos, 500, 30).fill('#FFF8E1').stroke('#F59E0B');
        doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(10)
           .text(`RESERVED FOR CUSTOMER: ${grn.customer}`, 60, yPos + 8, { width: 480 });
        doc.fillColor('black');
        yPos += 40;
      }

      // PR Description
      if (grn.pr_description) {
        doc.font('Helvetica-Bold').fontSize(10).text('PR Description:', 50, yPos);
        doc.font('Helvetica').text(grn.pr_description, 150, yPos, { width: 400 });
        yPos += 25;
      }

      // Remarks
      if (grn.remarks) {
        doc.font('Helvetica-Bold').text('Remarks:', 50, yPos);
        doc.font('Helvetica').text(grn.remarks, 120, yPos, { width: 430 });
        yPos += 30;
      }

      // Items table
      yPos += 15;
      doc.font('Helvetica-Bold').fontSize(12).text('ITEMS RECEIVED', 50, yPos);
      yPos += 20;

      // Table headers
      const tableHeaders = ['#', 'Code', 'Description', 'Qty Ordered', 'Qty Received', 'Unit', 'Condition'];
      const colWidths = [25, 60, 150, 65, 70, 50, 80];
      let xPos = 50;

      // Draw header row
      doc.rect(50, yPos, 500, 20).fill('#f0f0f0').stroke();
      doc.fillColor('black').fontSize(8).font('Helvetica-Bold');

      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos + 2, yPos + 5, { width: colWidths[i] - 4, align: 'left' });
        xPos += colWidths[i];
      });
      yPos += 20;

      // Draw item rows
      doc.font('Helvetica').fontSize(8);
      items.forEach((item, index) => {
        if (yPos > 680) {
          doc.addPage();
          yPos = 50;
        }

        xPos = 50;
        doc.rect(50, yPos, 500, 20).stroke();

        const rowData = [
          (index + 1).toString(),
          item.item_code || '-',
          item.description || item.item_name || '-',
          (item.quantity_ordered || 0).toString(),
          (item.quantity_received || 0).toString(),
          item.unit || 'pcs',
          item.condition_notes || 'Good'
        ];

        rowData.forEach((data, i) => {
          doc.text(data, xPos + 2, yPos + 5, { width: colWidths[i] - 4, align: 'left' });
          xPos += colWidths[i];
        });
        yPos += 20;
      });

      // Approval section
      yPos += 30;
      if (yPos > 620) {
        doc.addPage();
        yPos = 50;
      }

      doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('APPROVAL', 50, yPos);
      yPos += 20;

      const approval = (grn.approvals && grn.approvals.length > 0) ? grn.approvals[0] : null;
      const approvalStatus = approval && approval.action !== 'pending' ? approval.action.toUpperCase() : 'PENDING';

      // Approval status box
      if (approval && approval.action === 'approved') {
        doc.rect(50, yPos, 500, 60).fill('#E8F5E9').stroke('#4CAF50');
        doc.fillColor('#0000CC').font('Helvetica-Bold').fontSize(10)
           .text('Finance Approval: APPROVED', 60, yPos + 8);
        doc.fillColor('#0000CC').font('Helvetica')
           .text(`Approved By: ${approval.name || 'N/A'}`, 60, yPos + 24);
        doc.text(`Date: ${approval.date ? formatDate(approval.date) : 'N/A'}`, 300, yPos + 24);
        if (approval.comments) {
          doc.text(`Comments: ${approval.comments}`, 60, yPos + 40, { width: 480 });
        }
      } else if (approval && approval.action === 'rejected') {
        doc.rect(50, yPos, 500, 60).fill('#FFEBEE').stroke('#F44336');
        doc.fillColor('#C62828').font('Helvetica-Bold').fontSize(10)
           .text('Finance Approval: REJECTED', 60, yPos + 8);
        doc.fillColor('#C62828').font('Helvetica')
           .text(`Rejected By: ${approval.name || 'N/A'}`, 60, yPos + 24);
        doc.text(`Date: ${approval.date ? formatDate(approval.date) : 'N/A'}`, 300, yPos + 24);
        if (approval.comments) {
          doc.text(`Comments: ${approval.comments}`, 60, yPos + 40, { width: 480 });
        }
      } else {
        doc.rect(50, yPos, 500, 40).fill('#FFF8E1').stroke('#FFC107');
        doc.fillColor('#F57F17').font('Helvetica-Bold').fontSize(10)
           .text('Finance Approval: PENDING', 60, yPos + 8);
        if (grn.assigned_approver) {
          doc.fillColor('#F57F17').font('Helvetica')
             .text(`Assigned Approver: ${grn.assigned_approver}`, 60, yPos + 24);
        }
      }

      doc.fillColor('black');
      yPos += 75;

      // Signature section
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Received By:', 50, yPos);
      doc.font('Helvetica').text(grn.received_by || 'N/A', 130, yPos);
      doc.text('_______________________', 50, yPos + 30);
      doc.font('Helvetica-Bold').text('Signature', 50, yPos + 47);

      doc.font('Helvetica-Bold').text('Verified By:', 300, yPos);
      doc.font('Helvetica').text('_______________________', 300, yPos + 30);
      doc.font('Helvetica-Bold').text('Signature', 300, yPos + 47);

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
  generatePickingSlipPDF,
  generateGRNPDF
};
