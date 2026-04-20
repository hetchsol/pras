// Central status-transition table. Keeps approval workflow invariants
// in one place so a future refactor can't accidentally allow an
// "already approved" record to be approved again or an arbitrary status
// to be posted via the API.
//
// Each entry maps current status -> list of allowed next statuses.
const transitions = {
  Requisition: {
    draft: ['pending_hod'],
    pending_hod: ['pending_finance', 'rejected', 'pending_md'],
    pending_finance: ['pending_md', 'rejected', 'approved'],
    pending_md: ['approved', 'rejected'],
    approved: [],
    rejected: []
  },
  IssueSlip: {
    pending_hod: ['pending_finance', 'rejected'],
    pending_finance: ['approved', 'rejected'],
    approved: [],
    rejected: []
  },
  GRN: {
    pending_approval: ['approved', 'rejected'],
    approved: [],
    rejected: []
  },
  EFTRequisition: {
    pending_hod: ['pending_finance', 'rejected', 'approved'],
    pending_finance: ['approved', 'rejected', 'pending_md'],
    pending_md: ['approved', 'rejected'],
    approved: [],
    rejected: []
  },
  PettyCashRequisition: {
    pending_hod: ['pending_finance', 'rejected', 'approved'],
    pending_finance: ['approved', 'rejected'],
    approved: [],
    rejected: []
  },
  ExpenseClaim: {
    pending_hod: ['pending_finance', 'rejected', 'approved'],
    pending_finance: ['approved', 'rejected'],
    approved: [],
    rejected: []
  }
};

function assertTransition(kind, from, to) {
  const kindTable = transitions[kind];
  if (!kindTable) {
    const err = new Error(`Unknown entity kind for status transition: ${kind}`);
    err.status = 500;
    throw err;
  }
  const allowed = kindTable[from];
  if (!allowed) {
    const err = new Error(`Unknown source status for ${kind}: ${from}`);
    err.status = 400;
    throw err;
  }
  if (!allowed.includes(to)) {
    const err = new Error(`Invalid status transition for ${kind}: ${from} -> ${to}`);
    err.status = 400;
    throw err;
  }
}

module.exports = { transitions, assertTransition };
