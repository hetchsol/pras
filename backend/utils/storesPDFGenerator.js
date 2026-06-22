const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE SLIP PDF  — accent: warm amber
// ─────────────────────────────────────────────────────────────────────────────
async function generateIssueSlipPDF(slip, items, approvals, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PW = 495, LX = 50, RX = 545;

      const ACC     = '#92400E';  // amber-800  — heading text
      const ACC_MID = '#D97706';  // amber-600  — borders / rule
      const ACC_LT  = '#FEF3C7'; // amber-100  — fills
      const ACC_HDR = '#B45309'; // amber-700  — doc type + id

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, LX, 30, { height: 50 });

      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
         .text('KSB ZAMBIA LIMITED', 148, 33, { align: 'center', width: 349, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(ACC_HDR)
         .text('ISSUE SLIP', 148, 58, { align: 'center', width: 349, lineBreak: false });

      // Status badge
      const rawStatus = (slip.status || 'pending').toLowerCase();
      const statusLabel = rawStatus.replace(/_/g, ' ').toUpperCase();
      let bdBg, bdBdr, bdTxt;
      if (rawStatus === 'approved') {
        bdBg = '#D1FAE5'; bdBdr = '#059669'; bdTxt = '#065F46';
      } else if (rawStatus === 'rejected') {
        bdBg = '#FEE2E2'; bdBdr = '#DC2626'; bdTxt = '#991B1B';
      } else {
        bdBg = ACC_LT; bdBdr = ACC_MID; bdTxt = ACC;
      }
      doc.roundedRect(421, 30, 124, 22, 4).fillAndStroke(bdBg, bdBdr);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(bdTxt)
         .text(statusLabel, 423, 38, { width: 120, align: 'center', lineBreak: false });

      let y = 90;
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(2).strokeColor(ACC_MID).stroke();
      y += 6;

      // ── DOCUMENT ID ROW ───────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('SLIP ID:', LX + 6, y + 5, { width: 46, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC_HDR)
         .text(slip.id || '—', LX + 54, y + 5, { width: 250, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('Issue Date:', 370, y + 5, { width: 68, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(formatDate(slip.issue_date || slip.created_at), 442, y + 5, { width: 98, lineBreak: false });
      y += 24;

      // ── INFO GRID  4 rows × 2 cols ────────────────────────────
      const ROWH = 20;
      const C1L = LX, C1LW = 115, C1V = 168, C1VW = 133;
      const C2L = 307, C2LW = 104, C2V = 415, C2VW = 130;

      doc.rect(LX, y, PW, ROWH * 4).stroke('#CCCCCC');
      doc.moveTo(305, y).lineTo(305, y + ROWH * 4).stroke('#CCCCCC');
      [1, 2, 3].forEach(n =>
        doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE')
      );

      const infoRows = [
        ['Issued To:',         slip.issued_to,                                  'Delivery Date:',  formatDate(slip.delivery_date)],
        ['Department:',        slip.department || slip.initiator_department,     'Delivered By:',   slip.delivered_by],
        ['Reference No:',      slip.reference_number,                           'Created By:',     slip.initiator_name],
        ['Delivery Location:', slip.delivery_location,                          '',                ''],
      ];

      infoRows.forEach(([l1, v1, l2, v2], row) => {
        const ry = y + row * ROWH;
        if (row % 2 === 1) {
          doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#FFFBEB');
          doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#FFFBEB');
        }
        const ty = ry + 5;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l1, C1L + 5, ty, { width: C1LW, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(v1 || 'N/A'), C1V, ty, { width: C1VW, lineBreak: false });
        if (l2) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
             .text(l2, C2L + 5, ty, { width: C2LW, lineBreak: false });
          doc.font('Helvetica').fontSize(9).fillColor('#111111')
             .text(String(v2 || 'N/A'), C2V, ty, { width: C2VW, lineBreak: false });
        }
      });
      y += ROWH * 4 + 10;

      // ── CUSTOMER BANNER ───────────────────────────────────────
      if (slip.customer) {
        doc.roundedRect(LX, y, PW, 24, 3).fillAndStroke(ACC_LT, ACC_MID);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
           .text('CUSTOMER:', LX + 8, y + 7, { width: 70, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#78350F')
           .text(slip.customer, LX + 82, y + 7, { width: PW - 90, lineBreak: false });
        y += 32;
      }

      // ── REMARKS ───────────────────────────────────────────────
      if (slip.remarks) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Remarks:', LX, y, { width: 62, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(slip.remarks, LX + 66, y, { width: PW - 66 });
        y += Math.max(1, Math.ceil(slip.remarks.length / 70)) * 13 + 8;
      }
      y += 8;

      // ── ITEMS ISSUED ──────────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
         .text('ITEMS ISSUED', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      const itemCols = [
        { label: '#',           w: 24  },
        { label: 'Item Code',   w: 70  },
        { label: 'Description', w: 261 },
        { label: 'Qty',         w: 60  },
        { label: 'Unit',        w: 80  },
      ]; // 495

      doc.rect(LX, y, PW, 18).fill('#7C2D12');
      let cx = LX;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      itemCols.forEach(col => {
        doc.text(col.label, cx + 3, y + 5, { width: col.w - 6, lineBreak: false });
        cx += col.w;
      });
      y += 18;

      items.forEach((item, idx) => {
        if (y > 640) { doc.addPage(); y = 50; }
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#FFFBEB';
        doc.rect(LX, y, PW, 18).fillAndStroke(rowBg, '#E5D3B3');
        cx = LX;
        const cells = [
          String(idx + 1),
          item.item_code || '—',
          item.description || item.item_name || '—',
          String(item.quantity ?? 0),
          item.unit || 'pcs',
        ];
        doc.font('Helvetica').fontSize(8).fillColor('#111111');
        cells.forEach((val, i) => {
          doc.text(val, cx + 3, y + 5, { width: itemCols[i].w - 6, lineBreak: false });
          cx += itemCols[i].w;
        });
        y += 18;
      });
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(0.8).strokeColor('#AAAAAA').stroke();
      y += 16;

      // ── APPROVAL WORKFLOW ─────────────────────────────────────
      if (y > 590) { doc.addPage(); y = 50; }
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
         .text('APPROVAL WORKFLOW', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      const hodApproval     = (approvals || []).find(a => a.role === 'hod')     || null;
      const financeApproval = (approvals || []).find(a => a.role === 'finance') || null;
      const BOX_W  = 242;
      const BOX2_X = LX + BOX_W + 11; // 303

      function drawApprovalBox(ap, title, bx, by) {
        const action = ap ? (ap.action || 'pending').toLowerCase() : 'pending';
        let bg, bdr, tc;
        if (action === 'approved')      { bg = '#D1FAE5'; bdr = '#059669'; tc = '#065F46'; }
        else if (action === 'rejected') { bg = '#FEE2E2'; bdr = '#DC2626'; tc = '#991B1B'; }
        else                            { bg = ACC_LT;    bdr = ACC_MID;   tc = ACC;       }
        const hasComment = ap && (ap.comment || ap.comments);
        const bh = hasComment ? 74 : 58;
        doc.roundedRect(bx, by, BOX_W, bh, 4).fillAndStroke(bg, bdr);
        const lbl = action === 'approved' ? 'APPROVED' : action === 'rejected' ? 'REJECTED' : 'PENDING';
        doc.font('Helvetica-Bold').fontSize(9).fillColor(tc)
           .text(`${title}: ${lbl}`, bx + 8, by + 8, { width: BOX_W - 16, lineBreak: false });
        if (ap && action !== 'pending') {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc)
             .text('By:', bx + 8, by + 24, { width: 18, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc)
             .text(ap.user_name || ap.name || 'N/A', bx + 28, by + 24, { width: BOX_W - 36, lineBreak: false });
          doc.font('Helvetica-Bold').fontSize(8).fillColor(tc)
             .text('Date:', bx + 8, by + 38, { width: 26, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(tc)
             .text(formatDate(ap.timestamp || ap.date), bx + 36, by + 38, { width: BOX_W - 44, lineBreak: false });
          if (hasComment) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(tc)
               .text('Note:', bx + 8, by + 54, { width: 26, lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor(tc)
               .text(ap.comment || ap.comments, bx + 36, by + 54, { width: BOX_W - 44, lineBreak: false });
          }
        } else {
          doc.font('Helvetica').fontSize(8).fillColor(tc)
             .text('Awaiting approval', bx + 8, by + 24, { width: BOX_W - 16, lineBreak: false });
        }
        return bh;
      }

      const hodH = drawApprovalBox(hodApproval, 'HOD APPROVAL', LX, y);
      const finH = drawApprovalBox(financeApproval, 'FINANCE APPROVAL', BOX2_X, y);
      y += Math.max(hodH, finH) + 20;

      // ── COLLECTION ────────────────────────────────────────────
      if (y > 710) { doc.addPage(); y = 50; }
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
         .text('COLLECTION', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 28;

      const C3X = [LX, LX + 170, LX + 340];
      const C3W = [150, 150, 140];
      ['Collected By:', 'Signature:', 'Date:'].forEach((lbl, i) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
           .text(lbl, C3X[i], y, { width: C3W[i], lineBreak: false });
      });
      y += 28;
      C3X.forEach((x, i) => {
        doc.moveTo(x, y).lineTo(x + C3W[i], y).lineWidth(0.8).strokeColor('#555555').stroke();
      });
      y += 5;
      ['Name', 'Signature', 'Date'].forEach((lbl, i) => {
        doc.font('Helvetica').fontSize(8).fillColor('#777777')
           .text(lbl, C3X[i], y, { width: C3W[i], align: 'center', lineBreak: false });
      });

      // ── FOOTER ────────────────────────────────────────────────
      doc.moveTo(LX, 782).lineTo(RX, 782).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
         .text(
           `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${slip.id || ''}`,
           LX, 790, { width: PW, align: 'center', lineBreak: false }
         );

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) { reject(error); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PICKING SLIP PDF  — accent: indigo
// ─────────────────────────────────────────────────────────────────────────────
async function generatePickingSlipPDF(slip, items, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PW = 495, LX = 50, RX = 545;

      const ACC     = '#312E81';  // indigo-900
      const ACC_MID = '#6366F1';  // indigo-500
      const ACC_LT  = '#EEF2FF'; // indigo-50
      const ACC_HDR = '#4338CA'; // indigo-700

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, LX, 30, { height: 50 });

      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
         .text('KSB ZAMBIA LIMITED', 148, 33, { align: 'center', width: 349, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(ACC_HDR)
         .text('PICKING SLIP', 148, 58, { align: 'center', width: 349, lineBreak: false });

      // Picking slips are always completed
      doc.roundedRect(421, 30, 124, 22, 4).fillAndStroke('#D1FAE5', '#059669');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#065F46')
         .text('COMPLETED', 423, 38, { width: 120, align: 'center', lineBreak: false });

      let y = 90;
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(2).strokeColor(ACC_MID).stroke();
      y += 6;

      // ── DOCUMENT ID ROW ───────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('SLIP ID:', LX + 6, y + 5, { width: 46, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC_HDR)
         .text(slip.id || '—', LX + 54, y + 5, { width: 250, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
         .text('Pick Date:', 370, y + 5, { width: 66, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(formatDate(slip.pick_date || slip.created_at), 440, y + 5, { width: 100, lineBreak: false });
      y += 24;

      // ── INFO GRID  3 rows × 2 cols ────────────────────────────
      const ROWH = 20;
      const C1L = LX, C1LW = 115, C1V = 168, C1VW = 133;
      const C2L = 307, C2LW = 104, C2V = 415, C2VW = 130;

      doc.rect(LX, y, PW, ROWH * 3).stroke('#CCCCCC');
      doc.moveTo(305, y).lineTo(305, y + ROWH * 3).stroke('#CCCCCC');
      [1, 2].forEach(n =>
        doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE')
      );

      const infoRows = [
        ['Picked By:',    slip.picked_by,                               'Destination:',       slip.destination],
        ['Department:',   slip.department || slip.initiator_department,  'Delivery Location:', slip.delivery_location],
        ['Reference No:', slip.reference_number,                        'Created By:',        slip.initiator_name],
      ];

      infoRows.forEach(([l1, v1, l2, v2], row) => {
        const ry = y + row * ROWH;
        if (row % 2 === 1) {
          doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#F5F3FF');
          doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#F5F3FF');
        }
        const ty = ry + 5;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l1, C1L + 5, ty, { width: C1LW, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(v1 || 'N/A'), C1V, ty, { width: C1VW, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l2, C2L + 5, ty, { width: C2LW, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(v2 || 'N/A'), C2V, ty, { width: C2VW, lineBreak: false });
      });
      y += ROWH * 3 + 10;

      // ── CUSTOMER BANNER ───────────────────────────────────────
      if (slip.customer) {
        doc.roundedRect(LX, y, PW, 24, 3).fillAndStroke(ACC_LT, ACC_MID);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
           .text('CUSTOMER:', LX + 8, y + 7, { width: 70, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(ACC_HDR)
           .text(slip.customer, LX + 82, y + 7, { width: PW - 90, lineBreak: false });
        y += 32;
      }

      // ── REMARKS ───────────────────────────────────────────────
      if (slip.remarks) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Remarks:', LX, y, { width: 62, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(slip.remarks, LX + 66, y, { width: PW - 66 });
        y += Math.max(1, Math.ceil(slip.remarks.length / 70)) * 13 + 8;
      }
      y += 8;

      // ── ITEMS TO PICK ─────────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
         .text('ITEMS TO PICK', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      const itemCols = [
        { label: '#',           w: 24  },
        { label: 'Item Code',   w: 70  },
        { label: 'Description', w: 261 },
        { label: 'Qty',         w: 60  },
        { label: 'Unit',        w: 80  },
      ]; // 495

      doc.rect(LX, y, PW, 18).fill(ACC);
      let cx = LX;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      itemCols.forEach(col => {
        doc.text(col.label, cx + 3, y + 5, { width: col.w - 6, lineBreak: false });
        cx += col.w;
      });
      y += 18;

      items.forEach((item, idx) => {
        if (y > 700) { doc.addPage(); y = 50; }
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#EEF2FF';
        doc.rect(LX, y, PW, 18).fillAndStroke(rowBg, '#C7D2FE');
        cx = LX;
        const cells = [
          String(idx + 1),
          item.item_code || '—',
          item.description || item.item_name || '—',
          String(item.quantity ?? 0),
          item.unit || 'pcs',
        ];
        doc.font('Helvetica').fontSize(8).fillColor('#111111');
        cells.forEach((val, i) => {
          doc.text(val, cx + 3, y + 5, { width: itemCols[i].w - 6, lineBreak: false });
          cx += itemCols[i].w;
        });
        y += 18;
      });
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(0.8).strokeColor('#AAAAAA').stroke();
      y += 20;

      // ── SIGNATURES ────────────────────────────────────────────
      if (y > 720) { doc.addPage(); y = 50; }
      const SIG_W = 210;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('Prepared By:', LX, y, { width: 80, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(slip.initiator_name || 'N/A', LX + 84, y, { width: 130, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('Received By:', LX + 265, y, { width: 80, lineBreak: false });
      y += 28;
      doc.moveTo(LX, y).lineTo(LX + SIG_W, y).lineWidth(0.8).strokeColor('#555555').stroke();
      doc.moveTo(LX + 265, y).lineTo(LX + 265 + SIG_W, y).stroke();
      y += 5;
      doc.font('Helvetica').fontSize(8).fillColor('#777777')
         .text('Signature & Date', LX, y, { width: SIG_W, align: 'center', lineBreak: false });
      doc.text('Signature & Date', LX + 265, y, { width: SIG_W, align: 'center', lineBreak: false });

      // ── FOOTER ────────────────────────────────────────────────
      doc.moveTo(LX, 782).lineTo(RX, 782).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
         .text(
           `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${slip.id || ''}`,
           LX, 790, { width: PW, align: 'center', lineBreak: false }
         );

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) { reject(error); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GOODS RECEIPT NOTE PDF  — accent: forest green
// ─────────────────────────────────────────────────────────────────────────────
async function generateGRNPDF(grn, items, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PW = 495, LX = 50, RX = 545;
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) doc.image(logoPath, LX, 30, { height: 50 });

      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
         .text('KSB ZAMBIA LIMITED', 148, 33, { align: 'center', width: 349, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#065F46')
         .text('GOODS RECEIPT NOTE', 148, 58, { align: 'center', width: 349, lineBreak: false });

      // Status badge
      const rawStatus = (grn.status || 'pending').toLowerCase();
      const statusLabel = rawStatus.replace(/_/g, ' ').toUpperCase();
      let bdBg, bdBorder, bdText;
      if (rawStatus === 'approved' || rawStatus === 'received') {
        bdBg = '#D1FAE5'; bdBorder = '#059669'; bdText = '#065F46';
      } else if (rawStatus === 'rejected') {
        bdBg = '#FEE2E2'; bdBorder = '#DC2626'; bdText = '#991B1B';
      } else {
        bdBg = '#FEF3C7'; bdBorder = '#D97706'; bdText = '#92400E';
      }
      doc.roundedRect(421, 30, 124, 22, 4).fillAndStroke(bdBg, bdBorder);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(bdText)
         .text(statusLabel, 423, 38, { width: 120, align: 'center', lineBreak: false });

      let y = 90;
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(2).strokeColor('#059669').stroke();
      y += 6;

      // ── DOCUMENT ID ROW ───────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill('#ECFDF5');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#065F46')
         .text('GRN ID:', LX + 6, y + 5, { width: 44, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#047857')
         .text(grn.id || '—', LX + 52, y + 5, { width: 270, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#065F46')
         .text('Receipt Date:', 370, y + 5, { width: 76, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(formatDate(grn.receipt_date || grn.created_at), 450, y + 5, { width: 90, lineBreak: false });
      y += 24;

      // ── INFO GRID  4 rows × 2 cols ────────────────────────────
      const ROWH = 20;
      const C1L = LX, C1LW = 115, C1V = 168, C1VW = 133;
      const C2L = 307, C2LW = 104, C2V = 415, C2VW = 130;

      doc.rect(LX, y, PW, ROWH * 4).stroke('#CCCCCC');
      doc.moveTo(305, y).lineTo(305, y + ROWH * 4).stroke('#CCCCCC');
      [1, 2, 3].forEach(n =>
        doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE')
      );

      const gridRows = [
        ['Receipt Date:',    formatDate(grn.receipt_date || grn.created_at), 'Received By:',  grn.received_by],
        ['PR Reference:',    grn.pr_id,                                      'Department:',   grn.department],
        ['Supplier:',        grn.supplier,                                   'Invoice #:',    grn.invoice_number],
        ['Delivery Note #:', grn.delivery_note_number,                       'Created By:',   grn.initiator_name],
      ];

      gridRows.forEach(([l1, v1, l2, v2], row) => {
        const ry = y + row * ROWH;
        if (row % 2 === 1) {
          doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#F0FDF4');
          doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#F0FDF4');
        }
        const ty = ry + 5;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l1, C1L + 5, ty, { width: C1LW, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(v1 || 'N/A'), C1V, ty, { width: C1VW, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text(l2, C2L + 5, ty, { width: C2LW, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(String(v2 || 'N/A'), C2V, ty, { width: C2VW, lineBreak: false });
      });
      y += ROWH * 4 + 10;

      // ── RESERVATION BANNER ────────────────────────────────────
      if (grn.customer) {
        const resType = (grn.reservation_type || '').toLowerCase();
        const resLabel = resType === 'internal' ? 'INTERNAL RESERVATION' :
                         resType === 'external' ? 'EXTERNAL RESERVATION' :
                         resType === 'stores'   ? 'BOOKED INTO STORES'   : 'RESERVED FOR';
        doc.roundedRect(LX, y, PW, 24, 3).fillAndStroke('#FFFBEB', '#F59E0B');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#92400E')
           .text(`${resLabel}:`, LX + 8, y + 7, { width: 148, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#78350F')
           .text(grn.customer, LX + 160, y + 7, { width: PW - 168, lineBreak: false });
        y += 32;
      }

      // ── PR DESCRIPTION ────────────────────────────────────────
      if (grn.pr_description) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('PR Description:', LX, y, { width: 112, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(grn.pr_description, LX + 116, y, { width: PW - 116 });
        y += Math.max(1, Math.ceil(grn.pr_description.length / 62)) * 13 + 4;
      }

      // ── REMARKS ───────────────────────────────────────────────
      if (grn.remarks) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Remarks:', LX, y, { width: 62, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(grn.remarks, LX + 66, y, { width: PW - 66 });
        y += Math.max(1, Math.ceil(grn.remarks.length / 70)) * 13 + 6;
      }
      y += 8;

      // ── ITEMS TABLE ───────────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill('#ECFDF5');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#065F46')
         .text('ITEMS RECEIVED', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      const cols = [
        { label: '#',            w: 24  },
        { label: 'Item Code',    w: 62  },
        { label: 'Description',  w: 147 },
        { label: 'Qty Ordered',  w: 64  },
        { label: 'Qty Received', w: 64  },
        { label: 'Unit',         w: 46  },
        { label: 'Condition',    w: 88  },
      ]; // 24+62+147+64+64+46+88 = 495

      doc.rect(LX, y, PW, 18).fill('#065F46');
      let cx = LX;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      cols.forEach(col => {
        doc.text(col.label, cx + 3, y + 5, { width: col.w - 6, lineBreak: false });
        cx += col.w;
      });
      y += 18;

      items.forEach((item, idx) => {
        if (y > 700) { doc.addPage(); y = 50; }
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F0FDF4';
        doc.rect(LX, y, PW, 18).fillAndStroke(rowBg, '#BBF7D0');
        cx = LX;
        const cells = [
          String(idx + 1),
          item.item_code || '—',
          item.description || item.item_name || '—',
          String(item.quantity_ordered ?? 0),
          String(item.quantity_received ?? 0),
          item.unit || 'pcs',
          item.condition_notes || 'Good',
        ];
        doc.font('Helvetica').fontSize(8).fillColor('#111111');
        cells.forEach((val, i) => {
          doc.text(val, cx + 3, y + 5, { width: cols[i].w - 6, lineBreak: false });
          cx += cols[i].w;
        });
        y += 18;
      });
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(0.8).strokeColor('#AAAAAA').stroke();
      y += 16;

      // ── APPROVAL ──────────────────────────────────────────────
      if (y > 650) { doc.addPage(); y = 50; }
      doc.rect(LX, y, PW, 20).fill('#ECFDF5');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#065F46')
         .text('APPROVAL', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      const approval = (grn.approvals && grn.approvals.length > 0) ? grn.approvals[0] : null;
      let aBg, aBorder, aText;
      if (approval && approval.action === 'approved') {
        aBg = '#D1FAE5'; aBorder = '#059669'; aText = '#065F46';
      } else if (approval && approval.action === 'rejected') {
        aBg = '#FEE2E2'; aBorder = '#DC2626'; aText = '#991B1B';
      } else {
        aBg = '#FEF3C7'; aBorder = '#D97706'; aText = '#92400E';
      }

      const hasComments = !!(approval && approval.comments);
      const aBoxH = hasComments ? 68 : 52;
      doc.roundedRect(LX, y, PW, aBoxH, 4).fillAndStroke(aBg, aBorder);

      const aTitle = (approval && approval.action === 'approved') ? 'Finance Approval: APPROVED' :
                     (approval && approval.action === 'rejected') ? 'Finance Approval: REJECTED' :
                     'Finance Approval: PENDING';
      doc.font('Helvetica-Bold').fontSize(11).fillColor(aText)
         .text(aTitle, LX + 10, y + 10, { width: PW - 20, lineBreak: false });

      if (approval && approval.action && approval.action !== 'pending') {
        const byLabel = approval.action === 'approved' ? 'Approved By:' : 'Rejected By:';
        doc.font('Helvetica-Bold').fontSize(9).fillColor(aText)
           .text(byLabel, LX + 10, y + 28, { width: 80, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(aText)
           .text(approval.name || 'N/A', LX + 92, y + 28, { width: 160, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(aText)
           .text('Date:', 318, y + 28, { width: 34, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(aText)
           .text(approval.date ? formatDate(approval.date) : 'N/A', 355, y + 28, { width: 130, lineBreak: false });
        if (hasComments) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor(aText)
             .text('Comments:', LX + 10, y + 46, { width: 68, lineBreak: false });
          doc.font('Helvetica').fontSize(9).fillColor(aText)
             .text(approval.comments, LX + 80, y + 46, { width: PW - 90, lineBreak: false });
        }
      } else {
        const pending = grn.assigned_approver
          ? `Pending — Assigned to: ${grn.assigned_approver}`
          : 'Pending finance approval';
        doc.font('Helvetica').fontSize(9).fillColor(aText)
           .text(pending, LX + 10, y + 28, { width: PW - 20, lineBreak: false });
      }
      doc.fillColor('#000000');
      y += aBoxH + 20;

      // ── SIGNATURES ────────────────────────────────────────────
      if (y > 720) { doc.addPage(); y = 50; }
      const SIG_W = 210;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('Received By:', LX, y, { width: 80, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(grn.received_by || 'N/A', LX + 84, y, { width: 140, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('Verified By:', LX + 265, y, { width: 76, lineBreak: false });
      y += 28;
      doc.moveTo(LX, y).lineTo(LX + SIG_W, y).lineWidth(0.8).strokeColor('#555555').stroke();
      doc.moveTo(LX + 265, y).lineTo(LX + 265 + SIG_W, y).stroke();
      y += 5;
      doc.font('Helvetica').fontSize(8).fillColor('#777777')
         .text('Signature & Date', LX, y, { width: SIG_W, align: 'center', lineBreak: false });
      doc.text('Signature & Date', LX + 265, y, { width: SIG_W, align: 'center', lineBreak: false });

      // ── FOOTER ────────────────────────────────────────────────
      doc.moveTo(LX, 782).lineTo(RX, 782).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
         .text(
           `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${grn.id || ''}`,
           LX, 790, { width: PW, align: 'center', lineBreak: false }
         );

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) { reject(error); }
  });
}

module.exports = { generateIssueSlipPDF, generatePickingSlipPDF, generateGRNPDF };
