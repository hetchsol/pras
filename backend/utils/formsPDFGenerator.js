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
function addHeader(doc, title, status) {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 33, { height: 28 });
  }
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
     .text('KSB ZAMBIA LIMITED', 145, 34, { align: 'center', width: 265, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1D4ED8')
     .text(title, 145, 58, { align: 'center', width: 265, lineBreak: false });

  if (status) {
    const s = (status || '').toLowerCase().replace(/_/g, ' ');
    let bdBg, bdBdr, bdTxt;
    if (s.includes('approved') || s === 'completed') {
      bdBg = '#D1FAE5'; bdBdr = '#059669'; bdTxt = '#065F46';
    } else if (s.includes('rejected') || s.includes('declined')) {
      bdBg = '#FEE2E2'; bdBdr = '#DC2626'; bdTxt = '#991B1B';
    } else {
      bdBg = '#EEF2F8'; bdBdr = '#2563EB'; bdTxt = '#1E3A5F';
    }
    doc.roundedRect(421, 30, 124, 22, 4).fillAndStroke(bdBg, bdBdr);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(bdTxt)
       .text(s.toUpperCase(), 423, 38, { width: 120, align: 'center', lineBreak: false });
  }

  doc.moveTo(50, 90).lineTo(545, 90).lineWidth(2).strokeColor('#2563EB').stroke();
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
  // Check if Finance approved before/on behalf of HOD
  const financeApprovedBeforeHod = !hodApproval && financeApproval && financeApproval.action === 'approved';

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
  doc.text('HEAD OF DEPARTMENT:', 70, yPosition);
  yPosition += 15;
  if (hodApproval) {
    doc.font('Helvetica').fillColor('#000000').text('Name:', 70, yPosition);
    doc.fillColor('#0000CC').text(hodApproval.name || 'N/A', 108, yPosition);
    doc.fillColor('#000000').text('Action:', 250, yPosition);
    doc.fillColor('#0000CC').text(hodApproval.action ? hodApproval.action.toUpperCase() : 'N/A', 290, yPosition);
    doc.fillColor('#000000').text('Date/Time:', 370, yPosition);
    doc.fillColor('#0000CC').text(formatDateTime(hodApproval.date), 428, yPosition);
    yPosition += 12;
    doc.fillColor('#000000');
    if (hodApproval.comments) {
      doc.text('Comments:', 70, yPosition);
      doc.text(hodApproval.comments, 125, yPosition, { width: 405 });
    }
  } else if (financeApprovedBeforeHod) {
    doc.font('Helvetica').fillColor('#000000').text('Name:', 70, yPosition);
    doc.fillColor('#0000CC').text(`${financeApproval.name || 'Finance Manager'} (On behalf of HOD)`, 108, yPosition);
    doc.fillColor('#000000').text('Action:', 250, yPosition);
    doc.fillColor('#0000CC').text('APPROVED', 290, yPosition);
    doc.fillColor('#000000').text('Date/Time:', 370, yPosition);
    doc.fillColor('#0000CC').text(formatDateTime(financeApproval.date), 428, yPosition);
    yPosition += 12;
    doc.fillColor('#000000');
    if (financeApproval.comments) {
      doc.text('Comments:', 70, yPosition);
      doc.text(financeApproval.comments, 125, yPosition, { width: 405 });
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
    doc.font('Helvetica').fillColor('#000000').text('Name:', 70, yPosition);
    doc.fillColor('#0000CC').text(financeApproval.name || 'N/A', 108, yPosition);
    doc.fillColor('#000000').text('Action:', 250, yPosition);
    doc.fillColor('#0000CC').text(financeApproval.action ? financeApproval.action.toUpperCase() : 'N/A', 292, yPosition);
    doc.fillColor('#000000').text('Date/Time:', 370, yPosition);
    doc.fillColor('#0000CC').text(formatDateTime(financeApproval.date), 430, yPosition);
    yPosition += 12;
    doc.fillColor('#000000');
    if (financeApproval.comments) {
      doc.text('Comments:', 70, yPosition);
      doc.text(financeApproval.comments, 130, yPosition, { width: 400 });
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
    doc.font('Helvetica').fillColor('#000000').text('Name:', 70, yPosition);
    doc.fillColor('#0000CC').text(mdApproval.name || 'N/A', 108, yPosition);
    doc.fillColor('#000000').text('Action:', 250, yPosition);
    doc.fillColor('#0000CC').text(mdApproval.action ? mdApproval.action.toUpperCase() : 'N/A', 292, yPosition);
    doc.fillColor('#000000').text('Date/Time:', 370, yPosition);
    doc.fillColor('#0000CC').text(formatDateTime(mdApproval.date), 430, yPosition);
    yPosition += 12;
    doc.fillColor('#000000');
    if (mdApproval.comments) {
      doc.text('Comments:', 70, yPosition);
      doc.text(mdApproval.comments, 130, yPosition, { width: 400 });
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
      addHeader(doc, 'EXPENSE CLAIM FORM', claim.status);

      // Claim ID
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#000000').text('Claim ID:', 50, 100);
      doc.font('Helvetica').fillColor('#1D4ED8').text(claim.id, 110, 100);
      doc.fillColor('#000000');

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
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PW = 495, LX = 50, RX = 545;

      // Blue accent palette — matches PR and existing EFT header
      const ACC     = '#1E3A5F';
      const ACC_MID = '#2563EB';
      const ACC_LT  = '#EEF2F8';
      const ACC_HDR = '#1D4ED8';

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ──────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, LX, 33, { height: 28 });

      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
         .text('KSB ZAMBIA LIMITED', 145, 34, { align: 'center', width: 265, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(ACC_HDR)
         .text('EFT / CHEQUE REQUISITION FORM', 145, 58, { align: 'center', width: 265, lineBreak: false });

      // Status badge — reflects actual document status
      const rawStatus = (eft.status || 'pending').toLowerCase().replace(/_/g, ' ');
      let bdBg, bdBdr, bdTxt;
      if (rawStatus === 'approved') {
        bdBg = '#D1FAE5'; bdBdr = '#059669'; bdTxt = '#065F46';
      } else if (rawStatus.includes('reject')) {
        bdBg = '#FEE2E2'; bdBdr = '#DC2626'; bdTxt = '#991B1B';
      } else {
        bdBg = ACC_LT; bdBdr = ACC_MID; bdTxt = ACC;
      }
      doc.roundedRect(421, 30, 124, 22, 4).fillAndStroke(bdBg, bdBdr);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(bdTxt)
         .text(rawStatus.toUpperCase(), 423, 38, { width: 120, align: 'center', lineBreak: false });

      let y = 90;
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(2).strokeColor(ACC_MID).stroke();
      y += 6;

      // ── EFT ID ROW ───────────────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('EFT ID:', LX + 6, y + 5, { width: 46, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC_HDR)
         .text(eft.id || '—', LX + 54, y + 5, { width: 250, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('Date:', 380, y + 5, { width: 40, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(formatDate(eft.created_at), 422, y + 5, { width: 118, lineBreak: false });
      y += 24;

      // ── INFO GRID (6 rows × 2 cols) ──────────────────────────────
      const ROWH = 22;
      const C1L = LX, C1LW = 120, C1V = 173, C1VW = 128;
      const C2L = 307, C2LW = 110, C2V = 420, C2VW = 120;

      const infoRows = [
        ['EFT / CHQ No:',    eft.eft_chq_number || 'N/A',         'Prepared By:',    eft.initiator_name || 'N/A'],
        ['Amount:',          formatCurrency(eft.amount),            'Department:',     eft.department || 'N/A'],
        ['In Favour Of:',    eft.in_favour_of || 'N/A',            'Account Code:',   eft.account_code || 'N/A'],
        ['Bank Account No:', eft.bank_account_number || 'N/A',     'Bank Name:',      eft.bank_name || 'N/A'],
        ['Branch:',          eft.branch || 'N/A',                  '',                ''],
      ];

      const gridH = ROWH * infoRows.length;
      doc.rect(LX, y, PW, gridH).stroke('#CCCCCC');
      doc.moveTo(305, y).lineTo(305, y + gridH).stroke('#CCCCCC');
      for (let n = 1; n < infoRows.length; n++)
        doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE');

      infoRows.forEach(([l1, v1, l2, v2], row) => {
        const ry = y + row * ROWH;
        if (row % 2 === 1) {
          doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#F0F4FB');
          doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#F0F4FB');
        }
        const ty = ry + 6;
        // Highlight the amount row
        if (l1 === 'Amount:') {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#1D4ED8')
             .text(v1, C1V, ty - 1, { width: C1VW, lineBreak: false });
        } else {
          doc.font('Helvetica').fontSize(9).fillColor('#111111')
             .text(String(v1 || ''), C1V, ty, { width: C1VW, lineBreak: false });
        }
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l1, C1L + 5, ty, { width: C1LW, lineBreak: false });
        if (l2) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
             .text(l2, C2L + 5, ty, { width: C2LW, lineBreak: false });
          doc.font('Helvetica').fontSize(9).fillColor('#111111')
             .text(String(v2 || ''), C2V, ty, { width: C2VW, lineBreak: false });
        }
      });
      y += gridH + 10;

      // ── AMOUNT IN WORDS BANNER ───────────────────────────────────
      if (eft.amount_in_words) {
        doc.roundedRect(LX, y, PW, 26, 3).fillAndStroke(ACC_LT, ACC_MID);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
           .text('Amount in Words:', LX + 8, y + 8, { width: 100, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(ACC)
           .text(eft.amount_in_words, LX + 112, y + 8, { width: PW - 120, lineBreak: false });
        y += 34;
      }

      // ── PURPOSE ──────────────────────────────────────────────────
      if (eft.purpose) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Purpose:', LX, y, { width: 55, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(eft.purpose, LX + 60, y, { width: PW - 60 });
        const purposeLines = Math.max(1, Math.ceil(eft.purpose.length / 80));
        y += purposeLines * 13 + 8;
      }

      if (eft.description) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Description:', LX, y, { width: 70, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(eft.description, LX + 74, y, { width: PW - 74 });
        y += 20;
      }
      y += 10;

      // ── PREPARED BY (signature line) ─────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('PREPARED BY:', LX, y, { width: 90, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#111111')
         .text(eft.initiator_name || 'N/A', LX + 94, y, { lineBreak: false });
      y += 14;
      doc.font('Helvetica').fontSize(9).fillColor('#777777')
         .text(`Date: ${formatDate(eft.created_at)}`, LX, y, { lineBreak: false });
      y += 22;
      doc.moveTo(LX, y).lineTo(LX + 200, y).lineWidth(0.8).strokeColor('#555555').stroke();
      y += 4;
      doc.font('Helvetica').fontSize(8).fillColor('#777777')
         .text('Signature & Date', LX, y, { width: 200, align: 'center', lineBreak: false });
      y += 20;

      // ── APPROVAL WORKFLOW ────────────────────────────────────────
      y += 6;
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
         .text('APPROVAL WORKFLOW', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      const hodApproval  = (approvals || []).find(a => a.role === 'hod')  || null;
      const finApproval  = (approvals || []).find(a => a.role === 'finance' || a.role === 'finance_manager') || null;
      const mdApproval   = (approvals || []).find(a => a.role === 'md')   || null;

      const BOX_W  = 242;
      const BOX2_X = LX + BOX_W + 11;

      function drawApprovalBox(ap, title, bx, by, fullWidth) {
        const w = fullWidth ? PW : BOX_W;
        const action = ap ? (ap.action || 'pending').toLowerCase() : 'pending';
        let bg, bdr, tc;
        if (action === 'approved')      { bg = '#D1FAE5'; bdr = '#059669'; tc = '#065F46'; }
        else if (action === 'rejected') { bg = '#FEE2E2'; bdr = '#DC2626'; tc = '#991B1B'; }
        else                            { bg = ACC_LT;    bdr = ACC_MID;   tc = ACC;       }
        const hasComment = ap && (ap.comment || ap.comments);
        const bh = hasComment ? 78 : 62;
        doc.roundedRect(bx, by, w, bh, 4).fillAndStroke(bg, bdr);
        const lbl = action === 'approved' ? 'APPROVED' : action === 'rejected' ? 'REJECTED' : 'PENDING';
        doc.font('Helvetica-Bold').fontSize(9).fillColor(tc)
           .text(`${title}: ${lbl}`, bx + 8, by + 8, { width: w - 16, lineBreak: false });
        if (ap && action !== 'pending') {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc)
             .text('By:', bx + 8, by + 24, { width: 18, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc)
             .text(ap.user_name || ap.name || 'N/A', bx + 28, by + 24, { width: w - 36, lineBreak: false });
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc)
             .text('Date:', bx + 8, by + 38, { width: 26, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc)
             .text(formatDate(ap.timestamp || ap.date), bx + 36, by + 38, { width: w - 44, lineBreak: false });
          if (hasComment) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(tc)
               .text('Note:', bx + 8, by + 54, { width: 26, lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor(tc)
               .text(ap.comment || ap.comments, bx + 36, by + 54, { width: w - 44, lineBreak: false });
          }
        } else {
          // Pending — show placeholder sig line
          doc.font('Helvetica').fontSize(8).fillColor(tc)
             .text('Awaiting approval', bx + 8, by + 24, { width: w - 16, lineBreak: false });
          doc.moveTo(bx + 8, by + bh - 14).lineTo(bx + 140, by + bh - 14)
             .lineWidth(0.5).strokeColor(bdr).stroke();
          doc.font('Helvetica').fontSize(7).fillColor(tc)
             .text('Signature & Date', bx + 8, by + bh - 10, { width: 140, lineBreak: false });
        }
        return bh;
      }

      // Row 1: HOD | Finance Manager
      const hodH = drawApprovalBox(hodApproval, 'HEAD OF DEPARTMENT', LX, y, false);
      const finH = drawApprovalBox(finApproval, 'FINANCE MANAGER', BOX2_X, y, false);
      y += Math.max(hodH, finH) + 10;

      // Row 2: Managing Director (full width)
      const mdH = drawApprovalBox(mdApproval, 'MANAGING DIRECTOR', LX, y, true);
      y += mdH;

      // ── FOOTER ───────────────────────────────────────────────────
      doc.moveTo(LX, 775).lineTo(RX, 775).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
         .text(
           `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${eft.id || ''}`,
           LX, 780, { width: PW, align: 'center', lineBreak: false }
         );

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
      addHeader(doc, 'PETTY CASH REQUISITION FORM', pc.status);

      // PC ID
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#000000').text('Requisition ID:', 50, 100);
      doc.font('Helvetica').fillColor('#1D4ED8').text(pc.id, 140, 100);
      doc.fillColor('#000000');

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
