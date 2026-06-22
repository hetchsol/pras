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

const generateRequisitionPDF = (requisition, items, callback) => {
  try {
    // A4: 595 × 842 pt. Content area x: 50–545, y: 50–792.
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const PAGE_W = 495;
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => callback(null, Buffer.concat(chunks)));
    doc.on('error', err => callback(err, null));

    // ── HEADER ────────────────────────────────────────────────────
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 28, { height: 52 });
    }
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000')
       .text('KSB ZAMBIA LIMITED', 140, 34, { align: 'center', width: 355 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
       .text('PURCHASE REQUISITION', 140, 57, { align: 'center', width: 355 });

    // Status badge (top-right — no cursor movement)
    const rawStatus = (requisition.status || 'pending').toLowerCase().replace(/_/g, ' ');
    let badgeBg, badgeBorder, badgeColor;
    if (rawStatus.includes('approved') || rawStatus === 'completed') {
      badgeBg = '#E8F5E9'; badgeBorder = '#388E3C'; badgeColor = '#1B5E20';
    } else if (rawStatus.includes('rejected') || rawStatus.includes('declined')) {
      badgeBg = '#FFEBEE'; badgeBorder = '#D32F2F'; badgeColor = '#B71C1C';
    } else {
      badgeBg = '#FFF8E1'; badgeBorder = '#F9A825'; badgeColor = '#E65100';
    }
    doc.rect(415, 28, 130, 24).fill(badgeBg).stroke(badgeBorder);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(badgeColor)
       .text(rawStatus.toUpperCase(), 417, 36, { width: 126, align: 'center', lineBreak: false });
    doc.fillColor('#000000');

    // Divider
    let y = 92;
    doc.moveTo(50, y).lineTo(545, y).lineWidth(1.5).strokeColor('#003399').stroke();
    y += 8;

    // PR Number row
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
       .text('PR Number:', 50, y, { width: 72, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor('#0000CC')
       .text(requisition.req_number || requisition.id || '—', 126, y, { width: 280, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor('#333333')
       .text('Date:', 400, y, { width: 30, lineBreak: false });
    doc.font('Helvetica').fillColor('#000000')
       .text(fmtDate(requisition.created_at), 434, y, { width: 111, lineBreak: false });
    y += 18;

    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
    y += 10;

    // ── INFO GRID ─────────────────────────────────────────────────
    const L1 = 50, V1 = 162, V1W = 135, LW = 108;
    const L2 = 305, V2 = 403, V2W = 142, L2W = 94;
    const ROW_H = 17;

    function infoRow(lbl, val, rLbl, rVal) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text(lbl, L1, y, { width: LW, lineBreak: false });
      doc.font('Helvetica').fillColor('#000000')
         .text(String(val || 'N/A'), V1, y, { width: V1W, lineBreak: false });
      if (rLbl) {
        doc.font('Helvetica-Bold').fillColor('#333333')
           .text(rLbl, L2, y, { width: L2W, lineBreak: false });
        doc.font('Helvetica').fillColor('#000000')
           .text(String(rVal || 'N/A'), V2, y, { width: V2W, lineBreak: false });
      }
      y += ROW_H;
    }

    infoRow('Requested By:', requisition.created_by_name, 'Department:', requisition.department);
    infoRow('Required Date:', fmtDate(requisition.required_date), 'Urgency:', requisition.urgency || 'Medium');
    infoRow('Approved Vendor:', requisition.approved_vendor || 'TBD', 'Account Code:', requisition.account_code);
    infoRow('Delivery Location:', requisition.delivery_location, 'Approved Date:', fmtDate(requisition.md_approved_at));
    y += 8;

    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#DDDDDD').stroke();
    y += 10;

    // Description
    if (requisition.description) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('Description:', 50, y, { width: 108, lineBreak: false });
      doc.font('Helvetica').fillColor('#000000')
         .text(requisition.description, 162, y, { width: PAGE_W - 112, lineBreak: false });
      y += 17;
      y += 4;
    }

    y += 6;

    // ── ITEMS TABLE ───────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
       .text('ITEMS', 50, y, { width: PAGE_W, lineBreak: false });
    y += 16;

    const cols = [
      { label: '#',          w: 24  },
      { label: 'Code',       w: 55  },
      { label: 'Description',w: 163 },
      { label: 'Qty',        w: 40  },
      { label: 'Unit Price', w: 72  },
      { label: 'Total',      w: 72  },
      { label: 'Vendor',     w: 69  },
    ]; // sum = 495

    // Header row
    doc.rect(50, y, PAGE_W, 18).fill('#003366').stroke('#003366');
    let cx = 50;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
    cols.forEach(col => {
      doc.text(col.label, cx + 3, y + 5, { width: col.w - 6, lineBreak: false });
      cx += col.w;
    });
    y += 18;

    // Item rows
    let subtotal = 0;
    doc.fillColor('#000000').font('Helvetica').fontSize(8);
    items.forEach((item, idx) => {
      if (y > 710) { doc.addPage(); y = 50; }
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F5F7FA';
      doc.rect(50, y, PAGE_W, 18).fill(bg).stroke('#DDDDDD');
      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      subtotal += itemTotal;
      cx = 50;
      const row = [
        String(idx + 1),
        item.item_code || '—',
        item.item_name || item.description || '—',
        String(item.quantity || 0),
        fmtMoney(item.unit_price),
        fmtMoney(itemTotal),
        item.vendor_name || requisition.approved_vendor || 'TBD',
      ];
      doc.fillColor('#000000');
      row.forEach((val, i) => {
        doc.text(val, cx + 3, y + 5, { width: cols[i].w - 6, lineBreak: false });
        cx += cols[i].w;
      });
      y += 18;
    });

    // Totals rows
    const vat = subtotal * 0.16;
    const grandTotal = subtotal + vat;
    const totals = [
      ['Subtotal:', fmtMoney(subtotal)],
      ['VAT (16%):', fmtMoney(vat)],
    ];
    const COL_LABEL_X = 349;
    const COL_VAL_X   = 431;
    const COL_LABEL_W = 80;
    const COL_VAL_W   = 64;

    totals.forEach(([lbl, val]) => {
      doc.rect(50, y, PAGE_W, 16).fill('#F5F7FA').stroke('#DDDDDD');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#333333')
         .text(lbl, COL_LABEL_X, y + 4, { width: COL_LABEL_W, lineBreak: false });
      doc.font('Helvetica').fillColor('#000000')
         .text(val, COL_VAL_X, y + 4, { width: COL_VAL_W, lineBreak: false });
      y += 16;
    });

    doc.rect(50, y, PAGE_W, 20).fill('#E8F0FE').stroke('#003399');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#003399')
       .text('GRAND TOTAL:', COL_LABEL_X, y + 5, { width: COL_LABEL_W, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor('#003399')
       .text(fmtMoney(grandTotal), COL_VAL_X, y + 5, { width: COL_VAL_W, lineBreak: false });
    doc.fillColor('#000000');
    y += 28;

    // ── APPROVAL TRAIL ────────────────────────────────────────────
    const approvalSteps = [
      {
        label: 'HOD Approval',
        done: !!requisition.hod_approved_by,
        by: requisition.hod_approved_by_name || requisition.hod_approved_by,
        at: requisition.hod_approved_at,
        comments: requisition.hod_comments,
        action: 'Approved',
      },
      {
        label: 'MD Approval',
        done: !!requisition.md_approved_at,
        by: requisition.md_approved_by_name || requisition.md_approved_by,
        at: requisition.md_approved_at,
        comments: requisition.md_comments,
        action: 'Approved',
      },
    ].filter(s => s.done);

    if (approvalSteps.length > 0) {
      if (y > 660) { doc.addPage(); y = 50; }
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
         .text('APPROVAL TRAIL', 50, y, { width: PAGE_W, lineBreak: false });
      y += 14;

      approvalSteps.forEach(step => {
        const boxH = step.comments ? 54 : 40;
        doc.rect(50, y, PAGE_W, boxH).fill('#E8F5E9').stroke('#4CAF50');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1B5E20')
           .text(step.label, 60, y + 7, { width: 120, lineBreak: false });
        doc.font('Helvetica').fillColor('#1B5E20')
           .text(`${step.action} by: ${step.by || 'N/A'}`, 60, y + 22, { width: 230, lineBreak: false });
        doc.font('Helvetica-Bold')
           .text('Date:', 300, y + 22, { width: 34, lineBreak: false });
        doc.font('Helvetica')
           .text(fmtDate(step.at), 337, y + 22, { width: 150, lineBreak: false });
        if (step.comments) {
          doc.font('Helvetica-Bold').fillColor('#1B5E20')
             .text('Comments:', 60, y + 37, { width: 70, lineBreak: false });
          doc.font('Helvetica')
             .text(step.comments, 133, y + 37, { width: PAGE_W - 90, lineBreak: false });
        }
        doc.fillColor('#000000');
        y += boxH + 8;
      });
    }

    // Procurement details
    if (requisition.procurement_status === 'completed' && requisition.procurement_comments) {
      if (y > 680) { doc.addPage(); y = 50; }
      doc.rect(50, y, PAGE_W, 40).fill('#EDE7F6').stroke('#7E57C2');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#4527A0')
         .text('Procurement', 60, y + 7, { width: 100, lineBreak: false });
      doc.font('Helvetica').fillColor('#4527A0')
         .text(`Completed: ${fmtDate(requisition.procurement_completed_at)}`, 60, y + 22, { width: 230, lineBreak: false });
      doc.font('Helvetica-Bold')
         .text('Comments:', 300, y + 22, { width: 72, lineBreak: false });
      doc.font('Helvetica')
         .text(requisition.procurement_comments, 376, y + 22, { width: 160, lineBreak: false });
      doc.fillColor('#000000');
      y += 48;
    }

    // Footer
    if (y > 750) { doc.addPage(); y = 50; }
    doc.font('Helvetica').fontSize(8).fillColor('#888888')
       .text(
         `Generated ${new Date().toLocaleString()} | KSB Internal Approvals System`,
         50, y + 10, { align: 'center', width: PAGE_W, lineBreak: false }
       );

    doc.end();
  } catch (error) {
    callback(error, null);
  }
};

module.exports = {
    generateRequisitionPDF
};
