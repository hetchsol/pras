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
      // A4: 595 × 842 pt. Content area: x 50–545, y 50–792.
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const PW = 495;   // page content width
      const LX = 50;    // left margin
      const RX = 545;   // right margin
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // ─────────────────────────────────────────────────────────────
      // HEADER BAND
      // ─────────────────────────────────────────────────────────────
      const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, LX, 30, { height: 50 });
      }

      // Company name + document title (centred in remaining width)
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0A1628')
         .text('KSB ZAMBIA LIMITED', 148, 33, { align: 'center', width: 349, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#003399')
         .text('GOODS RECEIPT NOTE', 148, 58, { align: 'center', width: 349, lineBreak: false });

      // Status badge — top-right corner, fixed position, no effect on y flow
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

      // Blue rule under header
      let y = 90;
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(2).strokeColor('#003399').stroke();
      y += 6;

      // ─────────────────────────────────────────────────────────────
      // DOCUMENT ID ROW
      // ─────────────────────────────────────────────────────────────
      doc.rect(LX, y, PW, 20).fill('#F0F4FF');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555')
         .text('GRN ID:', LX + 6, y + 5, { width: 44, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#003399')
         .text(grn.id || '—', LX + 52, y + 5, { width: 270, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555')
         .text('Receipt Date:', 370, y + 5, { width: 76, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(formatDate(grn.receipt_date || grn.created_at), 450, y + 5, { width: 90, lineBreak: false });
      y += 24;

      // ─────────────────────────────────────────────────────────────
      // INFO GRID  (2 columns, 4 rows, bordered cells)
      // ─────────────────────────────────────────────────────────────
      // Column stops: label-left=50 | val-left=168 | col-mid=305 | label2-left=307 | val2-left=415
      const C1L = LX, C1LW = 115, C1V = 168, C1VW = 133;
      const C2L = 307, C2LW = 104, C2V = 415, C2VW = 130;
      const ROWH = 20;

      // outer border
      doc.rect(LX, y, PW, ROWH * 4).stroke('#CCCCCC');
      // vertical divider between columns
      doc.moveTo(305, y).lineTo(305, y + ROWH * 4).stroke('#CCCCCC');
      // horizontal row dividers
      [1, 2, 3].forEach(n => {
        doc.moveTo(LX, y + ROWH * n).lineTo(RX, y + ROWH * n).stroke('#EEEEEE');
      });

      const gridRows = [
        ['Receipt Date:',    formatDate(grn.receipt_date || grn.created_at), 'Received By:',     grn.received_by],
        ['PR Reference:',    grn.pr_id,                                       'Department:',      grn.department],
        ['Supplier:',        grn.supplier,                                    'Invoice #:',       grn.invoice_number],
        ['Delivery Note #:', grn.delivery_note_number,                        'Created By:',      grn.initiator_name],
      ];

      gridRows.forEach(([l1, v1, l2, v2], row) => {
        const ry = y + row * ROWH;
        // shade alternating rows
        if (row % 2 === 1) {
          doc.rect(LX + 1, ry + 1, 253, ROWH - 2).fill('#FAFBFF');
          doc.rect(306, ry + 1, PW - 256, ROWH - 2).fill('#FAFBFF');
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

      // ─────────────────────────────────────────────────────────────
      // RESERVATION BANNER  (only when present)
      // ─────────────────────────────────────────────────────────────
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

      // ─────────────────────────────────────────────────────────────
      // PR DESCRIPTION  (optional, allow wrapping for long text)
      // ─────────────────────────────────────────────────────────────
      if (grn.pr_description) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('PR Description:', LX, y, { width: 112, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(grn.pr_description, LX + 116, y, { width: PW - 116 });
        const lines = Math.max(1, Math.ceil(grn.pr_description.length / 62));
        y += lines * 13 + 4;
      }

      // ─────────────────────────────────────────────────────────────
      // REMARKS  (optional, allow wrapping)
      // ─────────────────────────────────────────────────────────────
      if (grn.remarks) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444')
           .text('Remarks:', LX, y, { width: 62, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#111111')
           .text(grn.remarks, LX + 66, y, { width: PW - 66 });
        const lines = Math.max(1, Math.ceil(grn.remarks.length / 70));
        y += lines * 13 + 6;
      }

      y += 8;

      // ─────────────────────────────────────────────────────────────
      // ITEMS TABLE
      // ─────────────────────────────────────────────────────────────
      // Section heading bar
      doc.rect(LX, y, PW, 20).fill('#E8EDF5');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0A1628')
         .text('ITEMS RECEIVED', LX + 8, y + 5, { width: PW - 16, lineBreak: false });
      y += 24;

      // Column definitions (widths sum to PW = 495)
      const cols = [
        { label: '#',            w: 24  },
        { label: 'Item Code',    w: 62  },
        { label: 'Description',  w: 147 },
        { label: 'Qty Ordered',  w: 64  },
        { label: 'Qty Received', w: 64  },
        { label: 'Unit',         w: 46  },
        { label: 'Condition',    w: 88  },
      ]; // 24+62+147+64+64+46+88 = 495

      // Table header row
      doc.rect(LX, y, PW, 18).fill('#003366');
      let cx = LX;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      cols.forEach(col => {
        doc.text(col.label, cx + 3, y + 5, { width: col.w - 6, lineBreak: false });
        cx += col.w;
      });
      y += 18;

      // Data rows
      doc.fontSize(8).fillColor('#000000');
      items.forEach((item, idx) => {
        if (y > 700) { doc.addPage(); y = 50; }
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F3F6FB';
        doc.rect(LX, y, PW, 18).fillAndStroke(rowBg, '#DDDDDD');
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

      // Bottom border of table
      doc.moveTo(LX, y).lineTo(RX, y).lineWidth(0.8).strokeColor('#AAAAAA').stroke();
      y += 16;

      // ─────────────────────────────────────────────────────────────
      // APPROVAL
      // ─────────────────────────────────────────────────────────────
      if (y > 650) { doc.addPage(); y = 50; }

      // Section heading bar
      doc.rect(LX, y, PW, 20).fill('#E8EDF5');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0A1628')
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
        const pending = grn.assigned_approver ? `Pending — Assigned to: ${grn.assigned_approver}` : 'Pending finance approval';
        doc.font('Helvetica').fontSize(9).fillColor(aText)
           .text(pending, LX + 10, y + 28, { width: PW - 20, lineBreak: false });
      }
      doc.fillColor('#000000');
      y += aBoxH + 20;

      // ─────────────────────────────────────────────────────────────
      // SIGNATURES
      // ─────────────────────────────────────────────────────────────
      if (y > 720) { doc.addPage(); y = 50; }

      // Two signature blocks side by side
      const SIG_W = 220;
      const SIG2X = 315;

      // Labels + names
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('Received By:', LX, y, { width: 80, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
         .text(grn.received_by || 'N/A', LX + 84, y, { width: 140, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333')
         .text('Verified By:', SIG2X, y, { width: 76, lineBreak: false });

      y += 28;
      // Signature lines
      doc.moveTo(LX, y).lineTo(LX + SIG_W, y).lineWidth(0.8).strokeColor('#555555').stroke();
      doc.moveTo(SIG2X, y).lineTo(SIG2X + SIG_W, y).stroke();
      y += 5;
      doc.font('Helvetica').fontSize(8).fillColor('#555555')
         .text('Signature & Date', LX, y, { width: SIG_W, align: 'center', lineBreak: false });
      doc.text('Signature & Date', SIG2X, y, { width: SIG_W, align: 'center', lineBreak: false });

      // ─────────────────────────────────────────────────────────────
      // FOOTER
      // ─────────────────────────────────────────────────────────────
      const FOOTER_Y = 790;
      doc.moveTo(LX, FOOTER_Y - 8).lineTo(RX, FOOTER_Y - 8).lineWidth(0.5).strokeColor('#CCCCCC').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
         .text(
           `Generated ${new Date().toLocaleString('en-GB')} · KSB Internal Approvals System · ${grn.id || ''}`,
           LX, FOOTER_Y,
           { width: PW, align: 'center', lineBreak: false }
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
  generateIssueSlipPDF,
  generatePickingSlipPDF,
  generateGRNPDF
};
