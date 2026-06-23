const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function fmtDate(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return isNaN(dt) ? 'N/A' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoney(n) {
  return `K ${Number(n || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE REQUISITION PDF  — accent: navy blue
// ─────────────────────────────────────────────────────────────────────────────
const generateRequisitionPDF = (requisition, items, callback) => {
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const PW = 495, LX = 50, RX = 545;
    const chunks = [];

    // Navy accent palette
    const ACC     = '#1E3A5F';  // navy-900  — heading text
    const ACC_MID = '#2563EB';  // blue-600  — borders / rule
    const ACC_LT  = '#EEF2F8'; // blue-50   — fills
    const ACC_HDR = '#1D4ED8'; // blue-700  — doc type + id

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => callback(null, Buffer.concat(chunks)));
    doc.on('error', err   => callback(err, null));

    // ── HEADER ──────────────────────────────────────────────────
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) doc.image(logoPath, LX, 33, { height: 28 });

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
       .text('KSB ZAMBIA LIMITED', 145, 34, { align: 'center', width: 265, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(ACC_HDR)
       .text('PURCHASE REQUISITION', 145, 58, { align: 'center', width: 265, lineBreak: false });

    // Status badge
    const rawStatus = (requisition.status || 'pending').toLowerCase().replace(/_/g, ' ');
    let bdBg, bdBdr, bdTxt;
    if (rawStatus.includes('approved') || rawStatus === 'completed') {
      bdBg = '#D1FAE5'; bdBdr = '#059669'; bdTxt = '#065F46';
    } else if (rawStatus.includes('rejected') || rawStatus.includes('declined')) {
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

    // ── DOCUMENT ID ROW ─────────────────────────────────────────
    doc.rect(LX, y, PW, 20).fill(ACC_LT);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
       .text('PR NUMBER:', LX + 6, y + 5, { width: 68, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC_HDR)
       .text(requisition.req_number || requisition.id || '—', LX + 76, y + 5, { width: 250, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(ACC)
       .text('Date:', 382, y + 5, { width: 36, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#000000')
       .text(fmtDate(requisition.created_at), 422, y + 5, { width: 118, lineBreak: false });
    y += 24;

    // ── INFO GRID  4 rows × 2 cols ───────────────────────────────
    const ROWH = 20;
    const C1L = LX, C1LW = 115, C1V = 168, C1VW = 133;
    const C2L = 307, C2LW = 104, C2V = 415, C2VW = 130;

    doc.rect(LX, y, PW, ROWH * 4).stroke('#CCCCCC');
    doc.moveTo(305, y).lineTo(305, y + ROWH * 4).stroke('#CCCCCC');
    [1, 2, 3].forEach(n =>
      doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE')
    );

    const gridRows = [
      ['Requested By:',    requisition.created_by_name,           'Department:',    requisition.department],
      ['Required Date:',   fmtDate(requisition.required_date),    'Urgency:',       requisition.urgency || 'Medium'],
      ['Approved Vendor:', requisition.approved_vendor || 'TBD',  'Account Code:',  requisition.account_code],
      ['Delivery Loc:',    requisition.delivery_location,         'Approved Date:', fmtDate(requisition.md_approved_at)],
    ];

    gridRows.forEach(([l1, v1, l2, v2], row) => {
      const ry = y + row * ROWH;
      if (row % 2 === 1) {
        doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#F0F4FF');
        doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#F0F4FF');
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

    // ── DESCRIPTION ─────────────────────────────────────────────
    if (requisition.description) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
         .text('Description:', LX, y, { width: 108, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#111111')
         .text(requisition.description, LX + 112, y, { width: PW - 112 });
      y += Math.max(1, Math.ceil(requisition.description.length / 62)) * 13 + 10;
    }

    y += 6;

    // ── ITEMS TABLE ──────────────────────────────────────────────
    doc.rect(LX, y, PW, 20).fill(ACC_LT);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
       .text('ITEMS', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
    y += 24;

    const cols = [
      { label: '#',           w: 24  },
      { label: 'Code',        w: 55  },
      { label: 'Description', w: 110 },
      { label: 'Qty',         w: 40  },
      { label: 'Unit Price',  w: 72  },
      { label: 'Total',       w: 72  },
      { label: 'Vendor',      w: 122 },
    ]; // 24+55+110+40+72+72+122 = 495

    doc.rect(LX, y, PW, 18).fill(ACC);
    let cx = LX;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
    cols.forEach(col => {
      doc.text(col.label, cx + 3, y + 5, { width: col.w - 6, lineBreak: false });
      cx += col.w;
    });
    y += 18;

    let subtotal = 0;
    items.forEach((item, idx) => {
      if (y > 710) { doc.addPage(); y = 50; }
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F0F4FF';
      doc.rect(LX, y, PW, 18).fillAndStroke(rowBg, '#D1D5DB');
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      subtotal += itemTotal;
      cx = LX;
      const row = [
        String(idx + 1),
        item.item_code || '—',
        item.item_name || item.description || '—',
        String(item.quantity || 0),
        fmtMoney(item.unit_price),
        fmtMoney(itemTotal),
        item.vendor_name || requisition.approved_vendor || 'TBD',
      ];
      doc.font('Helvetica').fontSize(8).fillColor('#111111');
      row.forEach((val, i) => {
        doc.text(val, cx + 3, y + 5, { width: cols[i].w - 6, lineBreak: false });
        cx += cols[i].w;
      });
      y += 18;
    });

    // Totals
    const vat = subtotal * 0.16;
    const grandTotal = subtotal + vat;
    const TLX = 349, TVX = 431, TLW = 80, TVW = 64;

    [['Subtotal:', fmtMoney(subtotal)], ['VAT (16%):', fmtMoney(vat)]].forEach(([lbl, val]) => {
      doc.rect(LX, y, PW, 16).fillAndStroke('#F3F4F6', '#D1D5DB');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#444444')
         .text(lbl, TLX, y + 4, { width: TLW, lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor('#111111')
         .text(val, TVX, y + 4, { width: TVW, lineBreak: false });
      y += 16;
    });

    doc.roundedRect(LX, y, PW, 22, 3).fillAndStroke('#DBEAFE', ACC_MID);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
       .text('GRAND TOTAL:', TLX, y + 6, { width: TLW, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
       .text(fmtMoney(grandTotal), TVX, y + 6, { width: TVW, lineBreak: false });
    y += 30;

    // ── APPROVAL TRAIL ───────────────────────────────────────────
    const approvalSteps = [
      {
        label: 'HOD Approval',
        done:  !!requisition.hod_approved_by,
        by:    requisition.hod_approved_by_name || requisition.hod_approved_by,
        at:    requisition.hod_approved_at,
        comments: requisition.hod_comments,
      },
      {
        label: 'MD / Executive Approval',
        done:  !!requisition.md_approved_at,
        by:    requisition.md_approved_by_name || requisition.md_approved_by,
        at:    requisition.md_approved_at,
        comments: requisition.md_comments,
      },
    ].filter(s => s.done);

    if (approvalSteps.length > 0) {
      if (y > 640) { doc.addPage(); y = 50; }
      doc.rect(LX, y, PW, 20).fill(ACC_LT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACC)
         .text('APPROVAL TRAIL', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      approvalSteps.forEach(step => {
        if (y > 680) { doc.addPage(); y = 50; }
        const boxH = step.comments ? 56 : 42;
        doc.roundedRect(LX, y, PW, boxH, 4).fillAndStroke('#D1FAE5', '#059669');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#065F46')
           .text(`${step.label}: APPROVED`, LX + 10, y + 8, { width: PW - 20, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#065F46')
           .text('Approved by:', LX + 10, y + 24, { width: 80, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#065F46')
           .text(step.by || 'N/A', LX + 92, y + 24, { width: 160, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#065F46')
           .text('Date:', 330, y + 24, { width: 32, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#065F46')
           .text(fmtDate(step.at), 365, y + 24, { width: 120, lineBreak: false });
        if (step.comments) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#065F46')
             .text('Comments:', LX + 10, y + 40, { width: 66, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor('#065F46')
             .text(step.comments, LX + 78, y + 40, { width: PW - 88, lineBreak: false });
        }
        y += boxH + 8;
      });
    }

    // ── PROCUREMENT COMPLETION ───────────────────────────────────
    if (requisition.procurement_status === 'completed') {
      if (y > 680) { doc.addPage(); y = 50; }
      const procH = requisition.procurement_comments ? 56 : 42;
      doc.roundedRect(LX, y, PW, procH, 4).fillAndStroke('#EDE7F6', '#7E57C2');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#4527A0')
         .text('Procurement: COMPLETED', LX + 10, y + 8, { width: PW - 20, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#4527A0')
         .text('Completed:', LX + 10, y + 24, { width: 62, lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor('#4527A0')
         .text(fmtDate(requisition.procurement_completed_at), LX + 74, y + 24, { width: 140, lineBreak: false });
      if (requisition.procurement_comments) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#4527A0')
           .text('Notes:', LX + 10, y + 40, { width: 40, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#4527A0')
           .text(requisition.procurement_comments, LX + 52, y + 40, { width: PW - 62, lineBreak: false });
      }
      y += procH + 8;
    }

    // ── FOOTER ───────────────────────────────────────────────────
    doc.moveTo(LX, 775).lineTo(RX, 775).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#888888')
       .text(
         `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${requisition.req_number || requisition.id || ''}`,
         LX, 780, { width: PW, align: 'center', lineBreak: false }
       );

    doc.end();
  } catch (error) {
    callback(error, null);
  }
};

module.exports = { generateRequisitionPDF };
