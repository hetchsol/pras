const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to format currency
function formatCurrency(amount) {
  return `K ${parseFloat(amount || 0).toFixed(2)}`;
}

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

// Helper function to format datetime with time
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

// Helper function to add approval workflow section
function addApprovalWorkflowSection(doc, approvals, yPosition) {
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
  doc.text('APPROVAL WORKFLOW', 50, yPosition);
  yPosition += 20;

  // Draw box around approval section
  doc.rect(50, yPosition, 500, 180).stroke();
  yPosition += 15;

  // Find approvals by role
  const hodApproval = approvals.find(a => a.role === 'hod');
  const financeApproval = approvals.find(a => a.role === 'finance');
  const mdApproval = approvals.find(a => a.role === 'md');

  // HOD Approval
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
  doc.text('HEAD OF DEPARTMENT:', 70, yPosition);
  yPosition += 15;
  if (hodApproval) {
    doc.font('Helvetica').fillColor('#0000CC')
       .text(`Name: ${hodApproval.name || 'N/A'}`, 70, yPosition)
       .text(`Action: ${hodApproval.action ? hodApproval.action.toUpperCase() : 'N/A'}`, 250, yPosition)
       .text(`Date/Time: ${formatDateTime(hodApproval.date)}`, 370, yPosition);
    yPosition += 12;
    doc.fillColor('#000000');
    if (hodApproval.comments) {
      doc.text(`Comments: ${hodApproval.comments}`, 70, yPosition, { width: 460 });
    }
  } else {
    doc.font('Helvetica').fillColor('#000000').text('Pending', 70, yPosition);
  }
  yPosition += 25;
  doc.fillColor('#000000');
  doc.moveTo(70, yPosition).lineTo(530, yPosition).stroke();
  yPosition += 15;

  // Finance Approval
  doc.font('Helvetica-Bold').fillColor('#000000');
  doc.text('FINANCE MANAGER:', 70, yPosition);
  yPosition += 15;
  if (financeApproval) {
    doc.font('Helvetica').fillColor('#0000CC')
       .text(`Name: ${financeApproval.name || 'N/A'}`, 70, yPosition)
       .text(`Action: ${financeApproval.action ? financeApproval.action.toUpperCase() : 'N/A'}`, 250, yPosition)
       .text(`Date/Time: ${formatDateTime(financeApproval.date)}`, 370, yPosition);
    yPosition += 12;
    doc.fillColor('#000000');
    if (financeApproval.comments) {
      doc.text(`Comments: ${financeApproval.comments}`, 70, yPosition, { width: 460 });
    }
  } else {
    doc.font('Helvetica').fillColor('#000000').text('Pending', 70, yPosition);
  }
  yPosition += 25;
  doc.fillColor('#000000');
  doc.moveTo(70, yPosition).lineTo(530, yPosition).stroke();
  yPosition += 15;

  // MD Approval
  doc.font('Helvetica-Bold').fillColor('#000000');
  doc.text('MANAGING DIRECTOR:', 70, yPosition);
  yPosition += 15;
  if (mdApproval) {
    doc.font('Helvetica').fillColor('#0000CC')
       .text(`Name: ${mdApproval.name || 'N/A'}`, 70, yPosition)
       .text(`Action: ${mdApproval.action ? mdApproval.action.toUpperCase() : 'N/A'}`, 250, yPosition)
       .text(`Date/Time: ${formatDateTime(mdApproval.date)}`, 370, yPosition);
    yPosition += 12;
    doc.fillColor('#000000');
    if (mdApproval.comments) {
      doc.text(`Comments: ${mdApproval.comments}`, 70, yPosition, { width: 460 });
    }
  } else {
    doc.font('Helvetica').fillColor('#000000').text('Pending', 70, yPosition);
  }

  doc.fillColor('#000000');
  return yPosition + 40;
}

// Legacy function for backward compatibility
function addSignatureSection(doc, approvals, yPosition) {
  return addApprovalWorkflowSection(doc, approvals, yPosition);
}

// Generate Expense Claim PDF
async function generateExpenseClaimPDF(claim, items, approvals, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      addHeader(doc, 'EXPENSE CLAIM FORM');

      // Claim ID and Status
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#0000CC').text(`Claim ID: ${claim.id}`, 50, 120)
         .fillColor('#000000').text(`Status: ${claim.status.replace(/_/g, ' ').toUpperCase()}`, 400, 120, { align: 'right' })
         .moveDown();

      // Employee Information
      let yPos = 150;
      doc.font('Helvetica-Bold').fontSize(12).text('EMPLOYEE INFORMATION', 50, yPos);
      yPos += 20;

      doc.fontSize(10).font('Helvetica');
      doc.text(`Employee Name: ${claim.employee_name}`, 50, yPos);
      doc.text(`Employee Number: ${claim.employee_number}`, 300, yPos);
      yPos += 15;

      doc.text(`Department: ${claim.department}`, 50, yPos);
      doc.text(`Date: ${formatDate(claim.created_at)}`, 300, yPos);
      yPos += 15;

      doc.text(`Reason for Trip: ${claim.reason_for_trip}`, 50, yPos, { width: 500 });
      yPos += 30;

      // Expense Items Table
      doc.font('Helvetica-Bold').fontSize(12).text('EXPENSE DETAILS', 50, yPos);
      yPos += 20;

      // Table headers
      doc.fontSize(9).font('Helvetica-Bold');
      const tableTop = yPos;
      const col1 = 50;  // Report No
      const col2 = 90;  // Date
      const col3 = 140; // Details
      const col4 = 280; // KM
      const col5 = 310; // Meals (B/L/D)
      const col6 = 380; // Accommodation
      const col7 = 450; // Phone
      const col8 = 500; // Total

      doc.text('No', col1, tableTop);
      doc.text('Date', col2, tableTop);
      doc.text('Details', col3, tableTop);
      doc.text('KM', col4, tableTop);
      doc.text('B L D', col5, tableTop);
      doc.text('Accom', col6, tableTop);
      doc.text('Phone', col7, tableTop);
      doc.text('Total', col8, tableTop);

      // Draw line under headers
      yPos += 15;
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
      yPos += 5;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      items.forEach((item, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const meals = `${item.breakfast ? 'B' : ''} ${item.lunch ? 'L' : ''} ${item.dinner ? 'D' : ''}`.trim();

        doc.text(item.report_no || (index + 1), col1, yPos);
        doc.text(formatDate(item.date), col2, yPos);
        doc.text(item.details || '', col3, yPos, { width: 130 });
        doc.text((item.km || 0).toString(), col4, yPos);
        doc.text(meals, col5, yPos);
        doc.text(formatCurrency(item.accommodation), col6, yPos);
        doc.text(formatCurrency(item.sundries_phone), col7, yPos);
        doc.text(formatCurrency(item.total_zmw), col8, yPos);

        yPos += 20;
      });

      // Draw line after items
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
      yPos += 15;

      // Totals Section
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Total Kilometers:', 350, yPos);
      doc.font('Helvetica').text(claim.total_kilometers || '0', 480, yPos);
      yPos += 15;

      doc.font('Helvetica-Bold').text('KM Rate:', 350, yPos);
      doc.font('Helvetica').text(formatCurrency(claim.km_rate), 480, yPos);
      yPos += 15;

      doc.font('Helvetica-Bold').text('Sub Total (Travel):', 350, yPos);
      doc.font('Helvetica').text(formatCurrency(claim.sub_total), 480, yPos);
      yPos += 15;

      doc.font('Helvetica-Bold').text('Total Travel:', 350, yPos);
      doc.font('Helvetica').text(formatCurrency(claim.total_travel), 480, yPos);
      yPos += 15;

      doc.font('Helvetica-Bold').text('TOTAL CLAIM:', 350, yPos);
      doc.font('Helvetica').text(formatCurrency(claim.total_claim), 480, yPos);
      yPos += 15;

      doc.font('Helvetica-Bold').text('Amount Advanced:', 350, yPos);
      doc.font('Helvetica').text(formatCurrency(claim.amount_advanced), 480, yPos);
      yPos += 15;

      doc.font('Helvetica-Bold').text('AMOUNT DUE:', 350, yPos);
      doc.font('Helvetica').text(formatCurrency(claim.amount_due), 480, yPos);
      yPos += 30;

      // Add new page for signatures if needed
      if (yPos > 600) {
        doc.addPage();
        yPos = 50;
      }

      // Signatures
      addSignatureSection(doc, approvals, yPos);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Generate EFT Requisition PDF
async function generateEFTPDF(eft, approvals, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      addHeader(doc, 'EFT / CHEQUE REQUISITION FORM');

      // EFT ID and Status
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#0000CC').text(`EFT ID: ${eft.id}`, 50, 120)
         .fillColor('#000000').text(`Status: ${eft.status.replace(/_/g, ' ').toUpperCase()}`, 400, 120, { align: 'right' })
         .moveDown();

      // Form Details
      let yPos = 150;

      // Box around main content
      doc.rect(50, yPos, 500, 320).stroke();
      yPos += 20;

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('EFT / CHQ NO:', 70, yPos);
      doc.font('Helvetica').text(eft.eft_chq_number || 'N/A', 200, yPos);
      yPos += 25;

      doc.font('Helvetica-Bold').text('AMOUNT:', 70, yPos);
      doc.font('Helvetica').fontSize(14).text(formatCurrency(eft.amount), 200, yPos);
      yPos += 25;

      doc.fontSize(11).font('Helvetica-Bold').text('AMOUNT IN WORDS:', 70, yPos);
      doc.font('Helvetica').text(eft.amount_in_words, 70, yPos + 15, { width: 460, align: 'center' });
      yPos += 45;

      doc.font('Helvetica-Bold').text('IN FAVOUR OF:', 70, yPos);
      doc.font('Helvetica').text(eft.in_favour_of, 200, yPos);
      yPos += 25;

      doc.font('Helvetica-Bold').text('BANK ACCOUNT NO:', 70, yPos);
      doc.font('Helvetica').text(eft.bank_account_number || 'N/A', 200, yPos);
      yPos += 25;

      doc.font('Helvetica-Bold').text('BANK NAME:', 70, yPos);
      doc.font('Helvetica').text(eft.bank_name || 'N/A', 200, yPos);
      yPos += 25;

      doc.font('Helvetica-Bold').text('BRANCH:', 70, yPos);
      doc.font('Helvetica').text(eft.branch || 'N/A', 200, yPos);
      yPos += 25;

      doc.font('Helvetica-Bold').text('PURPOSE:', 70, yPos);
      doc.font('Helvetica').text(eft.purpose, 70, yPos + 15, { width: 460 });
      yPos += 45;

      if (eft.account_code) {
        doc.font('Helvetica-Bold').text('ACCOUNT CODE:', 70, yPos);
        doc.font('Helvetica').text(eft.account_code, 200, yPos);
        yPos += 25;
      }

      if (eft.description) {
        doc.font('Helvetica-Bold').text('DESCRIPTION:', 70, yPos);
        doc.font('Helvetica').text(eft.description, 70, yPos + 15, { width: 460 });
        yPos += 45;
      }

      yPos = 490;

      // Initiator Information
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('PREPARED BY:', 70, yPos);
      doc.font('Helvetica').text(eft.initiator_name, 70, yPos + 15);
      doc.text(`Date: ${formatDate(eft.created_at)}`, 70, yPos + 30);
      doc.text('_______________________', 70, yPos + 50);
      doc.font('Helvetica-Bold').text('Signature & Date', 70, yPos + 65);

      yPos += 120;

      // Signatures
      addSignatureSection(doc, approvals, yPos);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Generate Petty Cash Requisition PDF
async function generatePettyCashPDF(pc, items, approvals, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      addHeader(doc, 'PETTY CASH REQUISITION FORM');

      // PC ID and Status
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#0000CC').text(`Requisition ID: ${pc.id}`, 50, 120)
         .fillColor('#000000').text(`Status: ${pc.status.replace(/_/g, ' ').toUpperCase()}`, 400, 120, { align: 'right' })
         .moveDown();

      // Form Details
      let yPos = 150;

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('DEPARTMENT:', 50, yPos);
      doc.font('Helvetica').text(pc.department, 180, yPos);
      yPos += 20;

      doc.font('Helvetica-Bold').text('PAYEE NAME:', 50, yPos);
      doc.font('Helvetica').text(pc.payee_name, 180, yPos);
      yPos += 20;

      doc.font('Helvetica-Bold').text('PURPOSE:', 50, yPos);
      doc.font('Helvetica').text(pc.purpose, 180, yPos, { width: 370 });
      yPos += 35;

      if (pc.description) {
        doc.font('Helvetica-Bold').text('DESCRIPTION:', 50, yPos);
        doc.font('Helvetica').text(pc.description, 180, yPos, { width: 370 });
        yPos += 35;
      }

      // Items Table
      doc.font('Helvetica-Bold').fontSize(12).text('ITEMS', 50, yPos);
      yPos += 20;

      // Table headers
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('No', 50, yPos);
      doc.text('Description', 100, yPos);
      doc.text('Amount', 450, yPos);

      yPos += 15;
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
      yPos += 10;

      // Table rows
      doc.font('Helvetica').fontSize(10);
      items.forEach((item) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        doc.text(item.item_no, 50, yPos);
        doc.text(item.description, 100, yPos, { width: 340 });
        doc.text(formatCurrency(item.amount), 450, yPos);

        yPos += 25;
      });

      // Draw line after items
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
      yPos += 15;

      // Total
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('TOTAL AMOUNT:', 320, yPos);
      doc.fontSize(14).text(formatCurrency(pc.amount), 450, yPos);
      yPos += 20;

      doc.fontSize(10).text('AMOUNT IN WORDS:', 50, yPos);
      doc.font('Helvetica').text(pc.amount_in_words, 50, yPos + 15, { width: 500, align: 'center' });
      yPos += 50;

      // Initiator Information
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('REQUESTED BY:', 50, yPos);
      doc.font('Helvetica').text(pc.initiator_name, 50, yPos + 15);
      doc.text(`Date: ${formatDate(pc.created_at)}`, 50, yPos + 30);
      doc.text('_______________________', 50, yPos + 50);
      doc.font('Helvetica-Bold').text('Signature & Date', 50, yPos + 65);

      yPos += 120;

      // Add new page for signatures if needed
      if (yPos > 600) {
        doc.addPage();
        yPos = 50;
      }

      // Signatures
      addSignatureSection(doc, approvals, yPos);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateExpenseClaimPDF,
  generateEFTPDF,
  generatePettyCashPDF
};
