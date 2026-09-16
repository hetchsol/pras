# Admin Reroute Expansion — Plan (drafted 2026-07-02)

**Update 2026-09-16**: EFT, Petty Cash and Expense Claim now have
working "Admin Reroute" (Skip Stage / Reassign Department) from the
Dashboard's Pending breakdown modal, reusing their pre-existing
`admin-override` endpoints — those endpoints already supported
`skip_stage`/`reassign_department` but the UI button that opens the
reroute modal was gated to Purchase Requisitions only
(`frontend/app.js`, Dashboard component, ~line 5112). "Assign to
Specific User" stays Purchase-Requisition-only since that action calls
the generic `/api/admin/reroute/:id` endpoint, which is hardcoded to
the `Requisition` model (§3c below is still unresolved for the other
three). GRN and Issue Slip remain unimplemented (§3a/§3b below).

Originally: not implemented yet — saved for a future session. Goal: let
an admin reroute *any* item stuck in an approval workflow to a
different specific approver, not just Purchase Requisitions (the only
entity that has this today).

---

## 1. Current state

| Entity | Approval shape | Named-approver field? | Reroute today? |
| --- | --- | --- | --- |
| Requisition (PR) | Multi-stage, role-based (`pending_hod` → ... → `approved`) | `assigned_to` / `assigned_role` / `assigned_hod_id` | **Yes** — `POST /api/admin/reroute/:id` |
| GRN | Single-stage | `assigned_approver` (name string, set at creation via `GRNApproverAssignment` lookup) | No |
| Issue Slip | Two-stage (`pending_hod` → `pending_finance` → `approved`) | None — role-gated only | No |
| EFT Requisition | Multi-stage (`pending_hod` → `pending_finance` → `pending_md` → `approved`) | None — role-gated only | No |
| Petty Cash Requisition | Two-stage (`pending_hod` → `pending_finance` → `approved`) | None — role-gated only | No |
| Expense Claim | Two-stage (`pending_hod` → `pending_finance` → `approved`) | None — role-gated only; a separate SQLite `regional_expense_approvers` table exists (maps users to department regions) but **is not consulted** by the approve route today | No |

Reference implementation (Requisition):
- `GET /api/admin/reroute-users` (`backend/server-mongo.js` ~line 1281) — lists users, optional `?role=` filter. **Already entity-agnostic**, reusable as-is.
- `POST /api/admin/reroute/:id` (~line 1301) — Requisition-specific: loads `db.Requisition`, sets `assigned_to`/`assigned_role`/`assigned_hod_id`, optional `new_status`, logs an `'rerouted'` approval entry.
- Frontend: `ApproveRequisition` component (`frontend/app.js` ~lines 3790-4984) has a reroute modal (~4891-4965) with three admin actions — skip stage, reassign department, assign to specific user — wired to `api.getRerouteUsers()` / `api.rerouteRequisition()`.

GRN/Issue Slip/EFT/Petty Cash/Expense Claim approve routes and their
`ApproveEFTRequisition` (~9115), `ApprovePettyCash` (~9452),
`ApproveExpenseClaim` (~8939), `ApproveIssueSlip` (~14380), and
`ViewGoodsReceiptNote` (~14955) view components have **no reroute UI**
at all today — just Approve/Reject.

---

## 2. Key structural split

Two genuinely different problems here, not one:

- **GRN** is single-stage and already has a *named* approver
  (`assigned_approver`). "Reroute" here just means: change that one
  field to a different name. Simple, low-risk.
- **Issue Slip / EFT / Petty Cash / Expense Claim** are role-staged
  with *no* named approver — anyone with the right role can act.
  "Reroute to a specific person" doesn't fit the current model as
  cleanly; it really means either (a) reroute to a specific person
  **and** trust them to act regardless of role, similar to how
  Requisition's `assigned_to` works, or (b) reroute by changing which
  *role/stage* the item is sitting in (closer to Requisition's
  existing "skip stage" / "reassign department" actions, which
  already exist per-entity via each form's `admin-override` route).

Recommendation: for the four role-staged entities, extend the
existing per-entity `admin-override` endpoints (they already exist:
`/api/forms/eft-requisitions/:id/admin-override`,
`/api/forms/petty-cash-requisitions/:id/admin-override`,
`/api/forms/expense-claims/:id/admin-override`, plus a new one needed
for Issue Slip) rather than bolting on Requisition's named-user
`assigned_to` model — cheaper, and consistent with how those forms
already handle admin overrides.

---

## 3. Proposed backend work

| # | Task |
| --- | --- |
| 3a | **GRN**: new `PUT /api/stores/grns/:id/reroute` (admin only) — body `{ to_user_name, reason }`, sets `assigned_approver`, logs to the GRN's own approvals array + `logAudit`. Reuses `GET /api/admin/reroute-users` for the picker. |
| 3b | **Issue Slip**: no `admin-override` route exists yet — add one (`PUT /api/stores/issue-slips/:id/admin-override`) supporting `skip_stage` (mirrors Requisition's), modeled on the EFT/Petty Cash/Expense Claim versions. |
| 3c | **EFT / Petty Cash / Expense Claim**: their `admin-override` routes already support `skip_stage` and `reassign_department` — audit whether that's sufficient, or whether a true "assign to named person" action (Requisition-style) is actually wanted. If so, each needs an `assigned_to`-equivalent field added to its model (schema change) and the approve route updated to also allow the assigned person through regardless of role. |
| 3d | Resolve the transitions.js discrepancy found during research: `backend/utils/statusTransitions.js` doesn't define a `pending_md` stage for Petty Cash or Expense Claim, but their approve routes reference `pending_md`/`md` role handling anyway. Needs a decision before building reroute logic on top of it, since reroute needs to know the *correct* next stage. |
| 3e | Decide whether Expense Claim reroute should validate the target user against the (currently unused) `regional_expense_approvers` table, or continue ignoring it, matching current behavior. |
| 3f | Audit every new reroute/override action via the existing `logAudit` helper, same as Requisition's `'rerouted'` action. |

---

## 4. Proposed frontend work

| # | Task |
| --- | --- |
| 4a | Extract the reroute modal out of `ApproveRequisition` (~4891-4965) into a reusable component, parameterized by entity type, current status, and available actions — avoids rebuilding the same modal 4-5 times. |
| 4b | Wire the extracted modal into `ApproveEFTRequisition`, `ApprovePettyCash`, `ApproveExpenseClaim`, `ApproveIssueSlip`, and `ViewGoodsReceiptNote`, each calling its entity's new/extended backend endpoint from §3. |
| 4c | `api.getRerouteUsers()` is already generic — no change needed. Add thin entity-specific wrappers around the new endpoints (mirroring `api.rerouteRequisition`). |

---

## 5. Suggested order

Given this is "the same feature rebuilt per entity" rather than one
change, recommend doing these one at a time rather than all at once —
pick whichever is actually causing pain first:

1. **GRN** — smallest, single-stage, already has a named-approver
   field to repoint. Good pilot for the pattern.
2. **Issue Slip** — two-stage, no existing `admin-override` route to
   build on, but simple transitions.
3. **EFT Requisition** — three-stage, existing `admin-override` route
   to extend.
4. **Petty Cash / Expense Claim** — same shape as EFT; do together
   once the pattern from #3 is proven. Expense Claim additionally
   needs the regional-approver decision (§3e) resolved first.

## 6. Open questions to resolve before starting

- Do we actually want Requisition-style "assign to a specific person
  regardless of role" for the four role-staged entities, or is
  extending their existing skip-stage/reassign-department actions
  enough? This changes whether §3c needs a schema change.
- What should happen to the unused `regional_expense_approvers` SQLite
  table — formalize it into the Mongo approval flow, or remove it as
  dead weight? Out of scope for reroute itself, but adjacent.
