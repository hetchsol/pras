/**
 * Archives and removes production entries created before a cutoff date.
 *
 * What it covers:
 *   - Requisition, GoodsReceiptNote, IssueSlip, PickingSlip, ExpenseClaim,
 *     PettyCashRequisition, EFTRequisition, ITEquipmentRequest — matched on
 *     their own `created_at`.
 *   - Approval / FormApproval — matched by parent document id, not by their
 *     own `timestamp`, so approval history stays attached to whichever
 *     documents get archived (and only those).
 *
 * What it deliberately does NOT touch:
 *   - AuditLog. Its schema comment states it exists so forensic questions
 *     can be answered "even if a document is later modified or deleted" —
 *     deleting it here would defeat that purpose. Excluded entirely.
 *   - User, Vendor, Client, Department, StockItem, SystemSetting, FXRate,
 *     Budget*, GRNApproverAssignment — reference/config data, not "entries".
 *
 * Safety model:
 *   - Always backs up matches to JSON first, one file per collection.
 *   - Only DELETES from production when run with --confirm. Without it,
 *     this is a dry run: backup + report, production untouched.
 *   - Deletes exactly the _ids that were just backed up (not a second,
 *     re-run query), so nothing written after the backup can be deleted.
 *
 * Usage:
 *   node backend/scripts/archiveEntriesBeforeDate.js                  # dry run, cutoff = 2026-08-26
 *   node backend/scripts/archiveEntriesBeforeDate.js --confirm        # actually delete after backup
 *   node backend/scripts/archiveEntriesBeforeDate.js --before=2026-09-01 --confirm
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const {
  Requisition,
  IssueSlip,
  PickingSlip,
  ExpenseClaim,
  PettyCashRequisition,
  EFTRequisition,
  ITEquipmentRequest,
  Approval,
  FormApproval
} = require('../models');
const GoodsReceiptNote = require('../models/GoodsReceiptNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/purchase_requisition_db';

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
const beforeArg = args.find(a => a.startsWith('--before='));
const BEFORE_DATE_STR = beforeArg ? beforeArg.split('=')[1] : '2026-08-26';

const cutoff = new Date(`${BEFORE_DATE_STR}T00:00:00`);
if (isNaN(cutoff.getTime())) {
  console.error(`Invalid --before date: "${BEFORE_DATE_STR}" (expected YYYY-MM-DD)`);
  process.exit(1);
}

// Core document collections: matched on their own created_at.
const CORE_COLLECTIONS = [
  { name: 'Requisitions', model: Requisition, formType: null },
  { name: 'GoodsReceiptNotes', model: GoodsReceiptNote, formType: 'grn' },
  { name: 'IssueSlips', model: IssueSlip, formType: 'issue_slip' },
  { name: 'PickingSlips', model: PickingSlip, formType: 'picking_slip' },
  { name: 'ExpenseClaims', model: ExpenseClaim, formType: 'expense_claim' },
  { name: 'PettyCashRequisitions', model: PettyCashRequisition, formType: 'petty_cash' },
  { name: 'EFTRequisitions', model: EFTRequisition, formType: 'eft' },
  { name: 'ITEquipmentRequests', model: ITEquipmentRequest, formType: 'it_equipment' }
];

function serialize(docs) {
  // Mongoose/BSON ObjectId and Date both stringify sensibly via their own
  // toJSON(), so plain JSON.stringify is enough for a readable backup.
  return JSON.stringify(docs, null, 2);
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB`);
  console.log(`Cutoff: entries with created_at < ${cutoff.toISOString()} (--before=${BEFORE_DATE_STR})`);
  console.log(CONFIRM ? 'Mode: LIVE — matched entries WILL be deleted after backup.' : 'Mode: DRY RUN — backup only, nothing will be deleted.');
  console.log('AuditLog is intentionally excluded (forensic log, kept even after documents are deleted).\n');

  const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', `archive-before-${BEFORE_DATE_STR}-${runStamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const summary = [];
  const archivedIdsByFormType = {}; // formType -> array of doc.id (custom KSB-... ids), for FormApproval matching
  const archivedRequisitionIds = []; // for Approval matching

  for (const { name, model, formType } of CORE_COLLECTIONS) {
    const docs = await model.find({ created_at: { $lt: cutoff } }).lean();
    const mongoIds = docs.map(d => d._id);
    const customIds = docs.map(d => d.id).filter(Boolean);

    const filePath = path.join(backupDir, `${name}.json`);
    fs.writeFileSync(filePath, serialize(docs));
    console.log(`${name}: ${docs.length} matched, backed up to ${filePath}`);

    if (name === 'Requisitions') archivedRequisitionIds.push(...customIds);
    if (formType) archivedIdsByFormType[formType] = customIds;

    let deleted = 0;
    if (CONFIRM && mongoIds.length > 0) {
      const result = await model.deleteMany({ _id: { $in: mongoIds } });
      deleted = result.deletedCount;
    }
    summary.push({ collection: name, matched: docs.length, deleted });
  }

  // Approval: tied to Requisitions by requisition_id, not by its own timestamp.
  {
    const approvals = await Approval.find({ requisition_id: { $in: archivedRequisitionIds } }).lean();
    const filePath = path.join(backupDir, 'Approvals.json');
    fs.writeFileSync(filePath, serialize(approvals));
    console.log(`Approvals (linked to archived Requisitions): ${approvals.length} matched, backed up to ${filePath}`);

    let deleted = 0;
    if (CONFIRM && approvals.length > 0) {
      const result = await Approval.deleteMany({ _id: { $in: approvals.map(a => a._id) } });
      deleted = result.deletedCount;
    }
    summary.push({ collection: 'Approvals', matched: approvals.length, deleted });
  }

  // FormApproval: tied to any archived document by (form_type, form_id).
  {
    const orClauses = Object.entries(archivedIdsByFormType)
      .filter(([, ids]) => ids.length > 0)
      .map(([form_type, ids]) => ({ form_type, form_id: { $in: ids } }));

    const formApprovals = orClauses.length > 0
      ? await FormApproval.find({ $or: orClauses }).lean()
      : [];

    const filePath = path.join(backupDir, 'FormApprovals.json');
    fs.writeFileSync(filePath, serialize(formApprovals));
    console.log(`FormApprovals (linked to archived documents): ${formApprovals.length} matched, backed up to ${filePath}`);

    let deleted = 0;
    if (CONFIRM && formApprovals.length > 0) {
      const result = await FormApproval.deleteMany({ _id: { $in: formApprovals.map(a => a._id) } });
      deleted = result.deletedCount;
    }
    summary.push({ collection: 'FormApprovals', matched: formApprovals.length, deleted });
  }

  console.log('\n=== Summary ===');
  console.table(summary);
  console.log(`Backup directory: ${backupDir}`);
  if (!CONFIRM) {
    console.log('\nDry run only — production was not modified. Re-run with --confirm to delete the backed-up records.');
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Archive script failed:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
