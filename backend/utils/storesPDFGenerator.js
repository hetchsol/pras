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

// Helper function to add APPROVED/DECLINED stamp (no border, bold text)
function addStatusStamp(doc, status, stampY) {
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
     .fillColor(stampColor).fillOpacity(0.7)
     .text(stampText, 350, 720);
  doc.restore();
  doc.fillOpacity(1).fillColor('#000000');
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
    doc.font('Helvetica').fillColor('#000000').text('Name:', 70, yPosition);
    doc.fillColor('#0000CC').text(hodApproval.user_name || hodApproval.name || 'N/A', 108, yPosition);
    doc.fillColor('#000000').text('Action:', 250, yPosition);
    doc.fillColor('#0000CC').text(hodApproval.action ? hodApproval.action.toUpperCase() : 'N/A', 292, yPosition);
    doc.fillColor('#000000').text('Date/Time:', 370, yPosition);
    doc.fillColor('#0000CC').text(formatDateTime(hodApproval.timestamp || hodApproval.date), 430, yPosition);
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
    doc.font('Helvetica').fillColor('#000000').text('Name:', 70, yPosition);
    doc.fillColor('#0000CC').text(financeApproval.user_name || financeApproval.name || 'N/A', 108, yPosition);
    doc.fillColor('#000000').text('Action:', 250, yPosition);
    doc.fillColor('#0000CC').text(financeApproval.action ? financeApproval.action.toUpperCase() : 'N/A', 292, yPosition);
    doc.fillColor('#000000').text('Date/Time:', 370, yPosition);
    doc.fillColor('#0000CC').text(formatDateTime(financeApproval.timestamp || financeApproval.date), 430, yPosition);
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

      // Slip ID and Status
      const statusText = slip.status.replace(/_/g, ' ').toUpperCase();
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#000000').text('Slip ID:', 50, 120);
      doc.fillColor('#0000CC').text(slip.id, 95, 120);
      doc.fillColor('#000000').text('Status:', 420, 120);
      doc.fillColor('#0000CC').text(statusText, 460, 120);
      doc.fillColor('#000000').moveDown();

      // Add status stamp below ID/Status line
      addStatusStamp(doc, slip.status);

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

      // Slip ID and Status
      const statusText2 = slip.status.replace(/_/g, ' ').toUpperCase();
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#000000').text('Slip ID:', 50, 120);
      doc.fillColor('#0000CC').text(slip.id, 95, 120);
      doc.fillColor('#000000').text('Status:', 420, 120);
      doc.fillColor('#0000CC').text(statusText2, 460, 120);
      doc.fillColor('#000000').moveDown();

      // Add status stamp below ID/Status line
      addStatusStamp(doc, slip.status);

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
      // A4: 595 × 842 pt. Content area x: 50–545, y: 50–792.
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PAGE_W = 495; // 545 - 50
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ── HEADER ──────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 28, { height: 52 });
      }
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000')
         .text('KSB ZAMBIA LIMITED', 140, 34, { align: 'center', width: 355 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
         .text('GOODS RECEIPT NOTE', 140, 57, { align: 'center', width: 355 });

      // Status badge (top-right, doesn't affect y flow)
      const rawStatus = (grn.status || 'pending').toLowerCase();
      const statusLabel = (grn.status || 'pending').replace(/_/g, ' ').toUpperCase();
      let badgeBg, badgeBorder, badgeColor;
      if (rawStatus === 'approved' || rawStatus === 'received') {
        badgeBg = '#E8F5E9'; badgeBorder = '#388E3C'; badgeColor = '#1B5E20';
      } else if (rawStatus === 'rejected') {
        badgeBg = '#FFEBEE'; badgeBorder = '#D32F2F'; badgeColor = '#B71C1C';
      } else {
        badgeBg = '#FFF8E1'; badgeBorder = '#F9A825'; badgeColor = '#E65100';
      }
      doc.rect(415, 28, 130, 24).fill(badgeBg).stroke(badgeBorder);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(badgeColor)
         .text(statusLabel, 417, 36, { width: 126, align: 'center', lineBreak: false });
      doc.fillColor('#000000');

      // Divider
      let y = 92;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(1.5).strokeColor('#003399').stroke();
      y += 8;

      // GRN ID row
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('GRN ID:', 50, y, { width: 48, lineBreak: false });
      doc.font('Helvetica-Bold').fillColor('#0000CC')
         .text(grn.id || '', 102, y, { width: 340, lineBreak: false });
      doc.font('Helvetica-Bold').fillColor('#333333')
         .text('Date:', 400, y, { width: 30, lineBreak: false });
      doc.font('Helvetica').fillColor('#000000')
         .text(formatDate(grn.receipt_date || grn.created_at), 434, y, { width: 111, lineBreak: false });
      y += 18;

      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      y += 10;

      // ── INFO GRID (2 columns × 4 rows) ──────────────────────────
      // L1=50  V1=162  |  L2=305  V2=405
      // LW=108          |  L2W=90   V2W=140
      const L1 = 50, V1 = 162, V1W = 135;
      const L2 = 305, V2 = 403, V2W = 142;
      const LW = 108, L2W = 94;
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

      infoRow('Receipt Date:', formatDate(grn.receipt_date || grn.created_at), 'Received By:', grn.received_by);
      infoRow('PR Reference:', grn.pr_id, 'Department:', grn.department);
      infoRow('Supplier:', grn.supplier, 'Invoice #:', grn.invoice_number);
      infoRow('Delivery Note #:', grn.delivery_note_number, 'Created By:', grn.initiator_name);
      y += 8;

      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#DDDDDD').stroke();
      y += 10;

      // ── RESERVATION ─────────────────────────────────────────────
      if (grn.customer) {
        const resType = (grn.reservation_type || '').toLowerCase();
        const resPrefix = resType === 'internal' ? 'INTERNAL RESERVATION' :
                          resType === 'external' ? 'EXTERNAL RESERVATION' :
                          resType === 'stores'   ? 'BOOKED INTO STORES'   : 'RESERVED FOR';
        doc.rect(50, y, PAGE_W, 22).fill('#FFF8E1').stroke('#F59E0B');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#92400E')
           .text(`${resPrefix}: ${grn.customer}`, 58, y + 6, { width: PAGE_W - 16, lineBreak: false });
        doc.fillColor('#000000');
        y += 30;
      }

      // ── PR DESCRIPTION ──────────────────────────────────────────
      if (grn.pr_description) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
           .text('PR Description:', 50, y, { width: 108, lineBreak: false });
        doc.font('Helvetica').fillColor('#000000')
           .text(grn.pr_description, 162, y, { width: PAGE_W - 112, lineBreak: false });
        y += 17;
      }

      // ── REMARKS ─────────────────────────────────────────────────
      if (grn.remarks) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
           .text('Remarks:', 50, y, { width: 72, lineBreak: false });
        doc.font('Helvetica').fillColor('#000000')
           .text(grn.remarks, 126, y, { width: PAGE_W - 76, lineBreak: false });
        y += 17;
      }

      y += 12;

      // ── ITEMS TABLE ─────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
         .text('ITEMS RECEIVED', 50, y, { width: PAGE_W, lineBreak: false });
      y += 16;

      const colDefs = [
        { label: '#',             w: 24  },
        { label: 'Code',          w: 58  },
        { label: 'Description',   w: 153 },
        { label: 'Qty Ordered',   w: 62  },
        { label: 'Qty Received',  w: 62  },
        { label: 'Unit',          w: 46  },
        { label: 'Condition',     w: 90  },
      ]; // sum = 495

      // Header row
      doc.rect(50, y, PAGE_W, 18).fill('#003366').stroke('#003366');
      let cx = 50;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      colDefs.forEach(col => {
        doc.text(col.label, cx + 3, y + 5, { width: col.w - 6, lineBreak: false });
        cx += col.w;
      });
      y += 18;

      // Item rows
      doc.fillColor('#000000').font('Helvetica').fontSize(8);
      items.forEach((item, idx) => {
        if (y > 710) { doc.addPage(); y = 50; }
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F5F7FA';
        doc.rect(50, y, PAGE_W, 18).fill(bg).stroke('#DDDDDD');
        cx = 50;
        const row = [
          String(idx + 1),
          item.item_code || '—',
          item.description || item.item_name || '—',
          String(item.quantity_ordered ?? 0),
          String(item.quantity_received ?? 0),
          item.unit || 'pcs',
          item.condition_notes || 'Good',
        ];
        doc.fillColor('#000000');
        row.forEach((val, i) => {
          doc.text(val, cx + 3, y + 5, { width: colDefs[i].w - 6, lineBreak: false });
          cx += colDefs[i].w;
        });
        y += 18;
      });
      y += 18;

      // ── APPROVAL ────────────────────────────────────────────────
      if (y > 660) { doc.addPage(); y = 50; }
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
         .text('APPROVAL', 50, y, { width: PAGE_W, lineBreak: false });
      y += 14;

      const approval = (grn.approvals && grn.approvals.length > 0) ? grn.approvals[0] : null;
      let aBg, aBorder, aColor;
      if (approval && approval.action === 'approved') {
        aBg = '#E8F5E9'; aBorder = '#4CAF50'; aColor = '#1B5E20';
      } else if (approval && approval.action === 'rejected') {
        aBg = '#FFEBEE'; aBorder = '#F44336'; aColor = '#B71C1C';
      } else {
        aBg = '#FFF8E1'; aBorder = '#FFC107'; aColor = '#E65100';
      }

      const hasComments = approval && approval.comments;
      const aBoxH = hasComments ? 66 : 50;
      doc.rect(50, y, PAGE_W, aBoxH).fill(aBg).stroke(aBorder);

      const aTitle = (approval && approval.action === 'approved') ? 'Finance Approval: APPROVED' :
                     (approval && approval.action === 'rejected') ? 'Finance Approval: REJECTED' :
                     'Finance Approval: PENDING';
      doc.font('Helvetica-Bold').fontSize(10).fillColor(aColor)
         .text(aTitle, 60, y + 9, { width: PAGE_W - 20, lineBreak: false });

      if (approval && approval.action && approval.action !== 'pending') {
        const byLabel = approval.action === 'approved' ? 'Approved By:' : 'Rejected By:';
        doc.font('Helvetica-Bold').fontSize(9).fillColor(aColor)
           .text(byLabel, 60, y + 26, { width: 82, lineBreak: false });
        doc.font('Helvetica')
           .text(approval.name || 'N/A', 146, y + 26, { width: 148, lineBreak: false });
        doc.font('Helvetica-Bold')
           .text('Date:', 304, y + 26, { width: 36, lineBreak: false });
        doc.font('Helvetica')
           .text(approval.date ? formatDate(approval.date) : 'N/A', 344, y + 26, { width: 150, lineBreak: false });
        if (hasComments) {
          doc.font('Helvetica-Bold').fillColor(aColor)
             .text('Comments:', 60, y + 43, { width: 70, lineBreak: false });
          doc.font('Helvetica')
             .text(approval.comments, 134, y + 43, { width: PAGE_W - 90, lineBreak: false });
        }
      } else if (grn.assigned_approver) {
        doc.font('Helvetica').fontSize(9).fillColor(aColor)
           .text(`Assigned Approver: ${grn.assigned_approver}`, 60, y + 26, { width: PAGE_W - 20, lineBreak: false });
      }

      doc.fillColor('#000000');
      y += aBoxH + 22;

      // ── SIGNATURES ──────────────────────────────────────────────
      if (y > 730) { doc.addPage(); y = 50; }
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
         .text('Received By:', 50, y, { width: 90, lineBreak: false });
      doc.font('Helvetica')
         .text(grn.received_by || 'N/A', 144, y, { width: 146, lineBreak: false });
      doc.font('Helvetica-Bold')
         .text('Verified By:', 310, y, { width: 84, lineBreak: false });
      y += 28;

      doc.moveTo(50, y).lineTo(232, y).lineWidth(0.8).strokeColor('#000000').stroke();
      doc.moveTo(310, y).lineTo(490, y).stroke();
      y += 5;
      doc.font('Helvetica-Bold').fontSize(9)
         .text('Signature', 50, y, { width: 100, lineBreak: false });
      doc.text('Signature', 310, y, { width: 100, lineBreak: false });

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
