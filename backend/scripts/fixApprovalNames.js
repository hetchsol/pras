/**
 * One-time migration script to fix approval records with missing approver names.
 *
 * Run with: node scripts/fixApprovalNames.js
 *
 * This script:
 * 1. Finds all documents with approvals where name is null/undefined/empty
 * 2. Looks up the approver by role from the Users collection
 * 3. Updates the approval record with the correct name
 */

const mongoose = require('mongoose');
const { User, ExpenseClaim, EFTRequisition, PettyCashRequisition, IssueSlip } = require('../models');
const GoodsReceiptNote = require('../models/GoodsReceiptNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/purchase_requisition_db';

async function fixApprovalNames() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all users grouped by role for lookup
    const users = await User.find({}).lean();
    console.log(`Found ${users.length} users`);

    // Build role -> user mapping
    const usersByRole = {};
    users.forEach(u => {
      const role = (u.role || '').toLowerCase();
      if (!usersByRole[role]) usersByRole[role] = [];
      usersByRole[role].push(u);
    });

    console.log('Users by role:');
    Object.keys(usersByRole).forEach(role => {
      console.log(`  ${role}: ${usersByRole[role].map(u => u.full_name).join(', ')}`);
    });

    let totalFixed = 0;

    // Helper to find best matching user for an approval
    function findApproverName(approval, document) {
      const role = (approval.role || '').toLowerCase();
      const candidates = usersByRole[role] || [];

      if (candidates.length === 1) {
        return candidates[0].full_name;
      }

      if (candidates.length > 1) {
        // Try to match by department
        const dept = (document.department || document.initiator_department || '').toLowerCase();
        const deptMatch = candidates.find(u => (u.department || '').toLowerCase() === dept);
        if (deptMatch) return deptMatch.full_name;

        // Return first candidate as fallback
        return candidates[0].full_name;
      }

      return null;
    }

    // Fix each collection
    const collections = [
      { name: 'ExpenseClaims', model: ExpenseClaim },
      { name: 'EFTRequisitions', model: EFTRequisition },
      { name: 'PettyCashRequisitions', model: PettyCashRequisition },
      { name: 'IssueSlips', model: IssueSlip },
      { name: 'GoodsReceiptNotes', model: GoodsReceiptNote }
    ];

    for (const { name, model } of collections) {
      console.log(`\nProcessing ${name}...`);

      // Find documents that have approvals array
      const docs = await model.find({
        approvals: { $exists: true, $ne: [] }
      });

      let fixed = 0;
      for (const doc of docs) {
        let modified = false;

        if (doc.approvals && doc.approvals.length > 0) {
          for (let i = 0; i < doc.approvals.length; i++) {
            const approval = doc.approvals[i];
            if (!approval.name || approval.name === 'undefined' || approval.name === 'null') {
              const resolvedName = findApproverName(approval, doc);
              if (resolvedName) {
                console.log(`  [${doc.id || doc._id}] ${approval.role}: "${approval.name}" -> "${resolvedName}"`);
                doc.approvals[i].name = resolvedName;
                modified = true;
                fixed++;
              } else {
                console.log(`  [${doc.id || doc._id}] ${approval.role}: Could not resolve name (no user with role "${approval.role}")`);
              }
            }
          }
        }

        if (modified) {
          doc.markModified('approvals');
          await doc.save();
        }
      }

      console.log(`  Fixed ${fixed} approval(s) in ${name}`);
      totalFixed += fixed;
    }

    console.log(`\nDone! Fixed ${totalFixed} total approval records.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixApprovalNames();
