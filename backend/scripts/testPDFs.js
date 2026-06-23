/**
 * Standalone PDF generation test — no server or DB needed.
 * Runs all four generators with realistic sample data and saves
 * the output to backend/test-pdfs/
 */
const path = require('path');
const fs   = require('fs');

const { generateIssueSlipPDF, generatePickingSlipPDF, generateGRNPDF } =
  require('../utils/storesPDFGenerator');
const { generateRequisitionPDF } =
  require('../utils/pdfGenerator');

const OUT_DIR = path.join(__dirname, '..', 'test-pdfs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const now = new Date().toISOString();

// ── Sample data ────────────────────────────────────────────────────────────

const sampleGRN = {
  id: 'KSB-GRN-20260623080457358',
  status: 'approved',
  receipt_date: now,
  received_by: 'Justin Phiri',
  pr_id: 'KSB-PR-20260601120000001',
  department: 'Operations',
  supplier: 'Zambian Irritech Ltd',
  invoice_number: 'INV-2026-00145',
  delivery_note_number: 'DN-2026-00088',
  initiator_name: 'Haggai Mbunda',
  customer: 'Zambian Irritech Ltd',
  reservation_type: 'external',
  pr_description: 'Safety Boots for site personnel',
  remarks: 'Customer S/O No. 816004525 — Lina Zimba',
  assigned_approver: null,
  approvals: [{
    action: 'approved',
    name: 'Finance Manager',
    date: now,
    comments: 'Approved after verification of delivery note.',
  }],
};

const sampleGRNItems = [
  { item_code: 'SB-001', description: 'Safety Boots Size 8',  quantity_ordered: 10, quantity_received: 10, unit: 'pairs', condition_notes: 'Good' },
  { item_code: 'SB-002', description: 'Safety Boots Size 9',  quantity_ordered: 5,  quantity_received: 5,  unit: 'pairs', condition_notes: 'Good' },
  { item_code: 'SB-003', description: 'Safety Boots Size 10', quantity_ordered: 8,  quantity_received: 7,  unit: 'pairs', condition_notes: '1 pair damaged' },
];

const sampleIssueSlip = {
  id: 'KSB-ISS-20260623091200001',
  status: 'approved',
  issue_date: now,
  issued_to: 'Charles Banda',
  department: 'Operations',
  delivery_location: 'Site Office — Kafue',
  delivery_date: now,
  delivered_by: 'Stores Officer',
  reference_number: 'REF-2026-0042',
  initiator_name: 'Haggai Mbunda',
  customer: 'Zambian Irritech Ltd',
  remarks: 'Urgent delivery for site personnel before Monday morning shift.',
};

const sampleIssueItems = [
  { item_code: 'SB-001', description: 'Safety Boots Size 8',  quantity: 5,  unit: 'pairs' },
  { item_code: 'HC-010', description: 'Hard Hat (Yellow)',     quantity: 10, unit: 'pcs'  },
  { item_code: 'VV-003', description: 'High-Vis Vest Large',   quantity: 10, unit: 'pcs'  },
];

const sampleIssueApprovals = [
  { role: 'hod',     action: 'approved', user_name: 'Department Head',  date: now, comment: null },
  { role: 'finance', action: 'approved', user_name: 'Finance Manager',  date: now, comment: 'Stock verified.' },
];

const samplePickingSlip = {
  id: 'KSB-PSL-20260623092000001',
  status: 'completed',
  pick_date: now,
  picked_by: 'Stores Clerk',
  department: 'Stores',
  destination: 'Main Warehouse — Bay 3',
  delivery_location: 'Kafue Site',
  reference_number: 'REF-2026-0043',
  initiator_name: 'Haggai Mbunda',
  customer: null,
  remarks: 'Handle fragile items with care.',
};

const samplePickingItems = [
  { item_code: 'PVC-001', description: 'PVC Pipe 50mm × 6m',    quantity: 20, unit: 'pcs'  },
  { item_code: 'FIT-010', description: 'Elbow Fitting 50mm',     quantity: 40, unit: 'pcs'  },
  { item_code: 'FIT-011', description: 'T-Junction 50mm',        quantity: 15, unit: 'pcs'  },
  { item_code: 'GVL-002', description: 'Gate Valve 50mm Brass',  quantity: 6,  unit: 'pcs'  },
];

const samplePR = {
  id: 'KSB-PR-20260601120000001',
  req_number: 'PR-2026-0112',
  status: 'pending_hod',
  created_at: now,
  created_by_name: 'Haggai Mbunda',
  department: 'Operations',
  required_date: new Date(Date.now() + 7 * 86400000).toISOString(),
  urgency: 'High',
  approved_vendor: 'Zambian Irritech Ltd',
  account_code: 'OPS-2026-004',
  delivery_location: 'Site Office — Kafue',
  md_approved_at: null,
  description: 'Personal Protective Equipment for site personnel commencing Kafue irrigation project.',
  hod_approved_by: 'hod001',
  hod_approved_by_name: 'Department Head',
  hod_approved_at: now,
  hod_comments: 'Approved — urgent for site mobilisation.',
  md_approved_by: null,
  md_approved_at: null,
  md_comments: null,
  procurement_status: null,
};

const samplePRItems = [
  { item_code: 'SB-001', item_name: 'Safety Boots (assorted sizes)', quantity: 23,  unit_price: 145.00, vendor_name: 'Zambian Irritech Ltd' },
  { item_code: 'HC-010', item_name: 'Hard Hat Yellow',               quantity: 10,  unit_price: 55.00,  vendor_name: 'Zambian Irritech Ltd' },
  { item_code: 'VV-003', item_name: 'High-Vis Vest Large',            quantity: 10,  unit_price: 35.00,  vendor_name: 'Zambian Irritech Ltd' },
  { item_code: 'GL-005', item_name: 'Safety Gloves (leather)',        quantity: 20,  unit_price: 28.50,  vendor_name: 'Zambian Irritech Ltd' },
];

// ── Run all four ────────────────────────────────────────────────────────────

async function run() {
  const results = [];

  try {
    const grnPath = path.join(OUT_DIR, 'test-grn.pdf');
    await generateGRNPDF(sampleGRN, sampleGRNItems, grnPath);
    const grnSize = fs.statSync(grnPath).size;
    results.push({ doc: 'GRN',         file: grnPath, size: grnSize, ok: grnSize > 5000 });
  } catch (e) {
    results.push({ doc: 'GRN',         error: e.message });
  }

  try {
    const issuePath = path.join(OUT_DIR, 'test-issue-slip.pdf');
    await generateIssueSlipPDF(sampleIssueSlip, sampleIssueItems, sampleIssueApprovals, issuePath);
    const issueSize = fs.statSync(issuePath).size;
    results.push({ doc: 'Issue Slip',  file: issuePath, size: issueSize, ok: issueSize > 5000 });
  } catch (e) {
    results.push({ doc: 'Issue Slip',  error: e.message });
  }

  try {
    const pickPath = path.join(OUT_DIR, 'test-picking-slip.pdf');
    await generatePickingSlipPDF(samplePickingSlip, samplePickingItems, pickPath);
    const pickSize = fs.statSync(pickPath).size;
    results.push({ doc: 'Picking Slip', file: pickPath, size: pickSize, ok: pickSize > 5000 });
  } catch (e) {
    results.push({ doc: 'Picking Slip', error: e.message });
  }

  // PR uses callback style
  await new Promise(resolve => {
    const prPath = path.join(OUT_DIR, 'test-pr.pdf');
    try {
      generateRequisitionPDF(samplePR, samplePRItems, (err, buf) => {
        if (err) {
          results.push({ doc: 'Purchase Requisition', error: err.message });
        } else {
          fs.writeFileSync(prPath, buf);
          const prSize = fs.statSync(prPath).size;
          results.push({ doc: 'Purchase Requisition', file: prPath, size: prSize, ok: prSize > 5000 });
        }
        resolve();
      });
    } catch (e) {
      results.push({ doc: 'Purchase Requisition', error: e.message });
      resolve();
    }
  });

  // Print results
  console.log('\n─────────────────────────────────────────────────────');
  console.log('PDF GENERATION TEST RESULTS');
  console.log('─────────────────────────────────────────────────────');
  results.forEach(r => {
    if (r.error) {
      console.log(`  FAIL  ${r.doc}`);
      console.log(`        ${r.error}`);
    } else {
      const kb = (r.size / 1024).toFixed(1);
      const status = r.ok ? 'PASS' : 'WARN (file too small)';
      console.log(`  ${status}  ${r.doc}  —  ${kb} KB`);
      console.log(`        ${r.file}`);
    }
  });
  console.log('─────────────────────────────────────────────────────\n');

  const failures = results.filter(r => r.error || !r.ok);
  process.exit(failures.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
