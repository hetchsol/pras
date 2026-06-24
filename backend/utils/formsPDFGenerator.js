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
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Helper function to format date + time
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d)) return 'N/A';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
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
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PW = 495, LX = 50, RX = 545;

      // Violet / purple palette
      const ACC     = '#4C1D95';
      const ACC_MID = '#7C3AED';
      const ACC_LT  = '#EDE9FE';
      const ACC_HDR = '#5B21B6';

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ──────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, LX, 33, { height: 28 });

      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
         .text('KSB ZAMBIA LIMITED', 145, 34, { align: 'center', width: 265, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(ACC_HDR)
         .text('EXPENSE CLAIM FORM', 145, 58, { align: 'center', width: 265, lineBreak: false });

      const rawStatus = (claim.status || 'pending').toLowerCase().replace(/_/g, ' ');
      let bdBg, bdBdr, bdTxt;
      if (rawStatus === 'approved')          { bdBg = '#D1FAE5'; bdBdr = '#059669'; bdTxt = '#065F46'; }
      else if (rawStatus.includes('reject')) { bdBg = '#FEE2E2'; bdBdr = '#DC2626'; bdTxt = '#991B1B'; }
      else                                   { bdBg = ACC_LT;    bdBdr = ACC_MID;   bdTxt = ACC;       }
      doc.roundedRect(421, 30, 124, 22, 4).fillAndStroke(bdBg, bdBdr);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(bdTxt)
         .text(rawStatus.toUpperCase(), 423, 38, { width: 120, align: 'center', lineBreak: false });

      let y = 90;
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(2).strokeColor(ACC_MID).stroke();
      y += 6;

      // ── ID ROW ───────────────────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('Claim ID:', LX + 6, y + 5, { width: 55, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC_HDR)
         .text(claim.id || '—', LX + 63, y + 5, { width: 245, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('Date:', 380, y + 5, { width: 40, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(formatDate(claim.created_at), 422, y + 5, { width: 118, lineBreak: false });
      y += 24;

      // ── EMPLOYEE INFO GRID ───────────────────────────────────────
      const ROWH = 22;
      const C1L = LX, C1LW = 120, C1V = 173, C1VW = 128;
      const C2L = 307, C2LW = 110, C2V = 420, C2VW = 120;

      const infoRows = [
        ['Employee Name:',   claim.employee_name   || 'N/A', 'Employee No:',   claim.employee_number || 'N/A'],
        ['Department:',      claim.department       || 'N/A', 'Prepared By:',   claim.initiator_name  || 'N/A'],
        ['Reason for Trip:', claim.reason_for_trip  || 'N/A', '',               ''],
      ];

      const gridH = ROWH * infoRows.length;
      doc.rect(LX, y, PW, gridH).stroke('#CCCCCC');
      doc.moveTo(305, y).lineTo(305, y + gridH).stroke('#CCCCCC');
      for (let n = 1; n < infoRows.length; n++)
        doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE');

      infoRows.forEach(([l1, v1, l2, v2], row) => {
        const ry = y + row * ROWH;
        if (row % 2 === 1) {
          doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#F5F3FF');
          doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#F5F3FF');
        }
        const ty = ry + 6;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l1, C1L + 5, ty, { width: C1LW, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(v1 || ''), C1V, ty, { width: C1VW, lineBreak: false });
        if (l2) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
             .text(l2, C2L + 5, ty, { width: C2LW, lineBreak: false });
          doc.font('Helvetica').fontSize(9).fillColor('#111111')
             .text(String(v2 || ''), C2V, ty, { width: C2VW, lineBreak: false });
        }
      });
      y += gridH + 10;

      // ── EXPENSE DETAILS TABLE ────────────────────────────────────
      // Column x-positions (all relative to LX=50)
      const cNo   = LX;       // 30px wide
      const cDate = LX + 32;  // 52px wide
      const cDet  = LX + 86;  // 130px wide
      const cKM   = LX + 218; // 32px wide
      const cMeal = LX + 252; // 42px wide
      const cAccom= LX + 296; // 68px wide
      const cPhone= LX + 366; // 58px wide
      const cTot  = LX + 426; // 68px wide (to RX=545)

      const TH = 20;
      doc.rect(LX, y, PW, TH).fill(ACC_HDR);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      doc.text('No',     cNo + 3,   y + 5, { width: 28,  lineBreak: false });
      doc.text('Date',   cDate + 2, y + 5, { width: 50,  lineBreak: false });
      doc.text('Details',cDet + 2,  y + 5, { width: 128, lineBreak: false });
      doc.text('KM',     cKM + 2,   y + 5, { width: 30,  lineBreak: false });
      doc.text('B/L/D',  cMeal + 2, y + 5, { width: 40,  lineBreak: false });
      doc.text('Accom',  cAccom + 2,y + 5, { width: 64,  lineBreak: false });
      doc.text('Phone',  cPhone + 2,y + 5, { width: 54,  lineBreak: false });
      doc.text('Total',  cTot + 2,  y + 5, { width: 66, align: 'right', lineBreak: false });
      y += TH;

      const ROW_H = 18;
      (items || []).forEach((item, idx) => {
        if (y > 650) { doc.addPage({ size: 'A4' }); y = 50; }
        if (idx % 2 === 1) doc.rect(LX, y, PW, ROW_H).fill('#F5F3FF');
        const meals = [item.breakfast && 'B', item.lunch && 'L', item.dinner && 'D'].filter(Boolean).join(' ') || '—';
        doc.font('Helvetica').fontSize(8).fillColor('#111111');
        doc.text(String(item.report_no || idx + 1), cNo + 3,    y + 4, { width: 28,  lineBreak: false });
        doc.text(formatDate(item.date),              cDate + 2,  y + 4, { width: 50,  lineBreak: false });
        doc.text(item.details || '',                 cDet + 2,   y + 4, { width: 128, lineBreak: false });
        doc.text(String(item.km || 0),               cKM + 2,    y + 4, { width: 30,  lineBreak: false });
        doc.text(meals,                              cMeal + 2,  y + 4, { width: 40,  lineBreak: false });
        doc.text(formatCurrency(item.accommodation), cAccom + 2, y + 4, { width: 64,  lineBreak: false });
        doc.text(formatCurrency(item.sundries_phone),cPhone + 2, y + 4, { width: 54,  lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
           .text(formatCurrency(item.total_zmw),     cTot + 2,   y + 4, { width: 66, align: 'right', lineBreak: false });
        y += ROW_H;
      });
      y += 4;

      // ── TOTALS BOX ───────────────────────────────────────────────
      const totRows = [
        ['Total Kilometers:',  String(claim.total_kilometers || '0') + ' km', false],
        ['KM Rate:',           formatCurrency(claim.km_rate),                  false],
        ['Sub Total (Travel):', formatCurrency(claim.sub_total),               false],
        ['Total Travel:',      formatCurrency(claim.total_travel),             false],
        ['TOTAL CLAIM:',       formatCurrency(claim.total_claim),              true ],
        ['Amount Advanced:',   formatCurrency(claim.amount_advanced),          false],
        ['AMOUNT DUE:',        formatCurrency(claim.amount_due),               true ],
      ];
      const TR_H = 18, TR_LW = 130, TR_LX = LX + 240, TR_VX = LX + 375;
      totRows.forEach(([lbl, val, highlight], i) => {
        const ry = y + i * TR_H;
        if (highlight) doc.rect(TR_LX, ry, PW - 240, TR_H).fill(ACC_LT);
        doc.font(highlight ? 'Helvetica-Bold' : 'Helvetica-Bold').fontSize(9)
           .fillColor(highlight ? ACC_HDR : '#444444')
           .text(lbl, TR_LX + 4, ry + 4, { width: TR_LW, lineBreak: false });
        doc.font(highlight ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
           .fillColor(highlight ? ACC_HDR : '#111111')
           .text(val, TR_VX, ry + 4, { width: RX - TR_VX - 4, align: 'right', lineBreak: false });
      });
      y += totRows.length * TR_H + 16;

      // ── PREPARED BY ──────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('PREPARED BY:', LX, y, { width: 90, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#111111')
         .text(claim.initiator_name || claim.employee_name || 'N/A', LX + 94, y, { lineBreak: false });
      y += 14;
      doc.font('Helvetica').fontSize(9).fillColor('#777777')
         .text(`Date: ${formatDate(claim.created_at)}`, LX, y, { lineBreak: false });
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

      const hodApproval = (approvals || []).find(a => a.role === 'hod')  || null;
      const finApproval = (approvals || []).find(a => a.role === 'finance' || a.role === 'finance_manager') || null;
      const mdApproval  = (approvals || []).find(a => a.role === 'md')   || null;

      const BOX_W  = 242;
      const BOX2_X = LX + BOX_W + 11;

      function drawBox(ap, title, bx, by, fullWidth) {
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
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc).text('By:', bx + 8, by + 24, { width: 18, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc).text(ap.user_name || ap.name || 'N/A', bx + 28, by + 24, { width: w - 36, lineBreak: false });
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc).text('Date:', bx + 8, by + 38, { width: 26, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc).text(formatDateTime(ap.timestamp || ap.date), bx + 36, by + 38, { width: w - 44, lineBreak: false });
          if (hasComment) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(tc).text('Note:', bx + 8, by + 54, { width: 26, lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor(tc).text(ap.comment || ap.comments, bx + 36, by + 54, { width: w - 44, lineBreak: false });
          }
        } else {
          doc.font('Helvetica').fontSize(8).fillColor(tc).text('Awaiting approval', bx + 8, by + 24, { width: w - 16, lineBreak: false });
          doc.moveTo(bx + 8, by + bh - 14).lineTo(bx + 140, by + bh - 14).lineWidth(0.5).strokeColor(bdr).stroke();
          doc.font('Helvetica').fontSize(7).fillColor(tc).text('Signature & Date', bx + 8, by + bh - 10, { width: 140, lineBreak: false });
        }
        return bh;
      }

      const hodH = drawBox(hodApproval, 'HEAD OF DEPARTMENT', LX, y, false);
      const finH = drawBox(finApproval, 'FINANCE MANAGER', BOX2_X, y, false);
      y += Math.max(hodH, finH) + 10;
      drawBox(mdApproval, 'MANAGING DIRECTOR', LX, y, true);

      // ── FOOTER ───────────────────────────────────────────────────
      doc.moveTo(LX, 775).lineTo(RX, 775).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
         .text(
           `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${claim.id || ''}`,
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
         .text('EFT REQUISITION FORM', 145, 58, { align: 'center', width: 265, lineBreak: false });

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
        ['EFT No:',          eft.eft_chq_number || 'N/A',         'Prepared By:',    eft.initiator_name || 'N/A'],
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
             .text(formatDateTime(ap.timestamp || ap.date), bx + 36, by + 38, { width: w - 44, lineBreak: false });
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
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PW = 495, LX = 50, RX = 545;

      // Emerald / green palette
      const ACC     = '#064E3B';
      const ACC_MID = '#059669';
      const ACC_LT  = '#D1FAE5';
      const ACC_HDR = '#047857';

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ──────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, LX, 33, { height: 28 });

      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
         .text('KSB ZAMBIA LIMITED', 145, 34, { align: 'center', width: 265, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(ACC_HDR)
         .text('PETTY CASH REQUISITION FORM', 145, 58, { align: 'center', width: 265, lineBreak: false });

      const rawStatus = (pc.status || 'pending').toLowerCase().replace(/_/g, ' ');
      let bdBg, bdBdr, bdTxt;
      if (rawStatus === 'approved')          { bdBg = '#D1FAE5'; bdBdr = '#059669'; bdTxt = '#065F46'; }
      else if (rawStatus.includes('reject')) { bdBg = '#FEE2E2'; bdBdr = '#DC2626'; bdTxt = '#991B1B'; }
      else                                   { bdBg = ACC_LT;    bdBdr = ACC_MID;   bdTxt = ACC;       }
      doc.roundedRect(421, 30, 124, 22, 4).fillAndStroke(bdBg, bdBdr);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(bdTxt)
         .text(rawStatus.toUpperCase(), 423, 38, { width: 120, align: 'center', lineBreak: false });

      let y = 90;
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(2).strokeColor(ACC_MID).stroke();
      y += 6;

      // ── ID ROW ───────────────────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('Requisition ID:', LX + 6, y + 5, { width: 80, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC_HDR)
         .text(pc.id || '—', LX + 88, y + 5, { width: 220, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('Date:', 380, y + 5, { width: 40, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(formatDate(pc.created_at), 422, y + 5, { width: 118, lineBreak: false });
      y += 24;

      // ── INFO GRID ────────────────────────────────────────────────
      const ROWH = 22;
      const C1L = LX, C1LW = 110, C1V = 163, C1VW = 138;
      const C2L = 307, C2LW = 110, C2V = 420, C2VW = 120;

      const infoRows = [
        ['Department:',  pc.department || 'N/A', 'Requested By:', pc.initiator_name || 'N/A'],
        ['Payee Name:',  pc.payee_name || 'N/A', '',             ''],
      ];

      const gridH = ROWH * infoRows.length;
      doc.rect(LX, y, PW, gridH).stroke('#CCCCCC');
      doc.moveTo(305, y).lineTo(305, y + gridH).stroke('#CCCCCC');
      for (let n = 1; n < infoRows.length; n++)
        doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE');

      infoRows.forEach(([l1, v1, l2, v2], row) => {
        const ry = y + row * ROWH;
        if (row % 2 === 1) {
          doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#F0FBF6');
          doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#F0FBF6');
        }
        const ty = ry + 6;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l1, C1L + 5, ty, { width: C1LW, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(v1 || ''), C1V, ty, { width: C1VW, lineBreak: false });
        if (l2) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
             .text(l2, C2L + 5, ty, { width: C2LW, lineBreak: false });
          doc.font('Helvetica').fontSize(9).fillColor('#111111')
             .text(String(v2 || ''), C2V, ty, { width: C2VW, lineBreak: false });
        }
      });
      y += gridH + 6;

      // ── PURPOSE ──────────────────────────────────────────────────
      if (pc.purpose) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Purpose:', LX, y, { width: 55, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(pc.purpose, LX + 60, y, { width: PW - 60 });
        y += Math.max(14, Math.ceil(pc.purpose.length / 80) * 13) + 4;
      }
      if (pc.description) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Description:', LX, y, { width: 70, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(pc.description, LX + 74, y, { width: PW - 74 });
        y += 16;
      }
      y += 8;

      // ── ITEMS TABLE ──────────────────────────────────────────────
      const TH = 20;
      doc.rect(LX, y, PW, TH).fill(ACC_HDR);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
         .text('No', LX + 6, y + 5, { width: 24, lineBreak: false })
         .text('Description', LX + 36, y + 5, { width: 380, lineBreak: false })
         .text('Amount', LX + 452, y + 5, { width: 40, align: 'right', lineBreak: false });
      y += TH;

      const ROW_H = 20;
      (items || []).forEach((item, idx) => {
        if (y > 630) { doc.addPage({ size: 'A4' }); y = 50; }
        if (idx % 2 === 1) doc.rect(LX, y, PW, ROW_H).fill('#F0FBF6');
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(item.item_no || idx + 1), LX + 6, y + 5, { width: 24, lineBreak: false })
           .text(item.description || '', LX + 36, y + 5, { width: 380, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
           .text(formatCurrency(item.amount), LX + 380, y + 5, { width: 112, align: 'right', lineBreak: false });
        y += ROW_H;
      });

      // Total row
      doc.rect(LX, y, PW, 22).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
         .text('TOTAL AMOUNT:', LX + 6, y + 5, { width: 370, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC_HDR)
         .text(formatCurrency(pc.amount), LX + 380, y + 5, { width: 112, align: 'right', lineBreak: false });
      y += 30;

      // ── AMOUNT IN WORDS BANNER ───────────────────────────────────
      if (pc.amount_in_words) {
        doc.roundedRect(LX, y, PW, 26, 3).fillAndStroke(ACC_LT, ACC_MID);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
           .text('Amount in Words:', LX + 8, y + 8, { width: 100, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(ACC)
           .text(pc.amount_in_words, LX + 112, y + 8, { width: PW - 120, lineBreak: false });
        y += 34;
      }
      y += 8;

      // ── REQUESTED BY ─────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('REQUESTED BY:', LX, y, { width: 90, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#111111')
         .text(pc.initiator_name || 'N/A', LX + 94, y, { lineBreak: false });
      y += 14;
      doc.font('Helvetica').fontSize(9).fillColor('#777777')
         .text(`Date: ${formatDate(pc.created_at)}`, LX, y, { lineBreak: false });
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

      const hodApproval = (approvals || []).find(a => a.role === 'hod')  || null;
      const finApproval = (approvals || []).find(a => a.role === 'finance' || a.role === 'finance_manager') || null;
      const mdApproval  = (approvals || []).find(a => a.role === 'md')   || null;

      const BOX_W  = 242;
      const BOX2_X = LX + BOX_W + 11;

      function drawBox(ap, title, bx, by, fullWidth) {
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
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc).text('By:', bx + 8, by + 24, { width: 18, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc).text(ap.user_name || ap.name || 'N/A', bx + 28, by + 24, { width: w - 36, lineBreak: false });
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc).text('Date:', bx + 8, by + 38, { width: 26, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc).text(formatDateTime(ap.timestamp || ap.date), bx + 36, by + 38, { width: w - 44, lineBreak: false });
          if (hasComment) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(tc).text('Note:', bx + 8, by + 54, { width: 26, lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor(tc).text(ap.comment || ap.comments, bx + 36, by + 54, { width: w - 44, lineBreak: false });
          }
        } else {
          doc.font('Helvetica').fontSize(8).fillColor(tc).text('Awaiting approval', bx + 8, by + 24, { width: w - 16, lineBreak: false });
          doc.moveTo(bx + 8, by + bh - 14).lineTo(bx + 140, by + bh - 14).lineWidth(0.5).strokeColor(bdr).stroke();
          doc.font('Helvetica').fontSize(7).fillColor(tc).text('Signature & Date', bx + 8, by + bh - 10, { width: 140, lineBreak: false });
        }
        return bh;
      }

      const hodH = drawBox(hodApproval, 'HEAD OF DEPARTMENT', LX, y, false);
      const finH = drawBox(finApproval, 'FINANCE MANAGER', BOX2_X, y, false);
      y += Math.max(hodH, finH) + 10;
      drawBox(mdApproval, 'MANAGING DIRECTOR', LX, y, true);

      // ── FOOTER ───────────────────────────────────────────────────
      doc.moveTo(LX, 775).lineTo(RX, 775).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
         .text(
           `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${pc.id || ''}`,
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

module.exports = {
  generateExpenseClaimPDF,
  generateEFTPDF,
  generatePettyCashPDF
};
