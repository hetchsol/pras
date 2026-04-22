// Budget enforcement helpers: currency conversion, availability checks,
// and atomic mutations on Department.{committed, spent}.
//
// Terminology:
//   budget    = allocated pot for the department (ZMW)
//   spent     = actual outflow (goods received via GRN approval)
//   committed = approved PRs that have passed Finance but not yet received
//   available = budget - spent - committed
//
// All amounts here are in ZMW. Callers must convert first.

const Department = require('../models/Department');
const FXRate = require('../models/FXRate');
const { logError } = require('./logger');

async function convertToZMW(amount, currency) {
  if (!amount) return 0;
  if (!currency || currency === 'ZMW') return amount;
  const rate = await FXRate.findOne({ currency_code: currency, is_active: 1 }).lean();
  if (!rate || !rate.rate_to_zmw) {
    throw new Error(`No active FX rate for currency '${currency}'`);
  }
  return amount * rate.rate_to_zmw;
}

// Authoritative ZMW total for a requisition. Prefers per-item
// amount_in_zmw snapshots (frozen at item entry time); falls back to
// converting the top-level amount using the stored vendor_currency.
async function getRequisitionAmountZMW(requisition) {
  if (requisition.items && requisition.items.length > 0) {
    const itemsZmw = requisition.items.reduce(
      (sum, item) => sum + (item.amount_in_zmw || 0),
      0
    );
    if (itemsZmw > 0) return itemsZmw;
  }
  const base = requisition.amount || requisition.estimated_cost || 0;
  return await convertToZMW(base, requisition.vendor_currency || 'ZMW');
}

// Does the department have `amountZMW` of headroom right now?
async function checkBudget(departmentName, amountZMW) {
  const dept = await Department.findOne({ name: departmentName }).lean();
  if (!dept) {
    // No department record = no enforceable budget. Don't block.
    logError(new Error('Budget check with no matching department'), {
      type: 'BUDGET_NO_DEPT', department: departmentName
    });
    return { ok: true, available: Infinity, over_by: 0, department: null };
  }
  const available = (dept.budget || 0) - (dept.spent || 0) - (dept.committed || 0);
  return {
    ok: available >= amountZMW,
    available,
    over_by: Math.max(0, amountZMW - available),
    department: dept
  };
}

// Is the department still solvent overall? Used as a defense-in-depth
// check at MD approve, after Finance has already committed.
async function checkSolvency(departmentName) {
  const dept = await Department.findOne({ name: departmentName }).lean();
  if (!dept) return { ok: true, available: Infinity, department: null };
  const available = (dept.budget || 0) - (dept.spent || 0) - (dept.committed || 0);
  return { ok: available >= 0, available, department: dept };
}

async function commitToBudget(departmentName, amountZMW) {
  if (!amountZMW) return;
  await Department.updateOne(
    { name: departmentName },
    { $inc: { committed: amountZMW } }
  );
}

async function releaseCommit(departmentName, amountZMW) {
  if (!amountZMW) return;
  await Department.updateOne(
    { name: departmentName },
    { $inc: { committed: -amountZMW } }
  );
}

// Move amount from committed to spent. Called when a GRN against the
// PR is approved (goods actually received).
async function shiftCommitToSpent(departmentName, amountZMW) {
  if (!amountZMW) return;
  await Department.updateOne(
    { name: departmentName },
    { $inc: { committed: -amountZMW, spent: amountZMW } }
  );
}

module.exports = {
  convertToZMW,
  getRequisitionAmountZMW,
  checkBudget,
  checkSolvency,
  commitToBudget,
  releaseCommit,
  shiftCommitToSpent
};
