# PRAS — Work Plan (drafted 2026-06-03)

Outstanding work agreed in conversation but not yet implemented, plus
follow-ups from recent commits.

---

## 1. Admin-managed EFT schedule

Replace the hardcoded constants in `backend/utils/eftSchedule.js` with
admin-editable config and a temporary-override mechanism.

| # | Task |
| --- | --- |
| 1a | New Mongo collection `EFTScheduleConfig` (single doc: `openHour`, `createCutoff`, `approveCutoff`, `enabledDays`, `updatedBy`, `updatedAt`). |
| 1b | Routes: `GET /api/admin/eft-schedule` and `PUT /api/admin/eft-schedule` (admin only). Refactor `getEFTAccess` to read from the doc with an in-memory cache invalidated on PUT. |
| 1c | Time-bound override: `{ overrideUntil, reason, setBy }` — admin can unlock the module until a chosen time; auto-expires. |
| 1d | Audit every config edit and override via the existing `logAudit`. |
| 1e | Admin UI panel: 4 numeric inputs + day toggles + Save button + "Open module until [datetime] for [reason]" form. |
| 1f | Frontend `useEFTAccess` hook switches from local computation to polling `/api/eft-requisitions/schedule` so config changes propagate without redeploy. |
| 1g | Update the 19 existing schedule tests to inject config; add new tests for override active / expired / admin-only. |

**Scope**: substantial — touches backend model, routes, util, audit,
frontend hook, admin panel, tests. ~600 lines.

---

## 2. Unified dark theme as the only theme

Drop the light/dark toggle entirely and ship a single dark theme app-wide.

| # | Task |
| --- | --- |
| 2a | Pick a two-shade scheme: page ~`#0F1115`, card ~`#12141A`. Close enough to feel unified, different enough to read a crisp 1px border. |
| 2b | Remove the `ThemeToggle` component and its localStorage state. Default `data-theme="dark"` permanently. |
| 2c | Re-tune `:root` tokens so the "dark" variables become the only set. |
| 2d | Add a thin top-edge highlight (1px lighter inner border) on cards so they read as floating. |
| 2e | Sweep `admin.html` and the standalone form pages (`eft-requisition.html` etc.) for hardcoded light backgrounds (`background: white`, `#FFFFFF` literals on cards) and convert to tokens. |
| 2f | Form inputs need explicit `background: var(--bg-tertiary)` + white text or browsers fall back to white-on-white. Audit `<input>`, `<select>`, `<textarea>` across all pages. |
| 2g | Visual audit each major surface: login, dashboard, sidebar, forms, modals, status pills, PDF preview, tables, charts. |

**Scope**: large — every visible surface needs verification. ~400 lines
plus visual QA.

---

## 3. Final icon strip (with home icon re-added)

Per the rule "get rid of all icons except the home icon".

| # | Task |
| --- | --- |
| 3a | Replace `ThemeToggle`'s `🌙/☀️` with text-only "Light / Dark" labels (or remove entirely if plan #2 lands first). |
| 3b | Search box: drop the `🔍` glyph and the spinning `⏳`; rely on placeholder text and a "Loading…" state. |
| 3c | Error boundary `⚠️` headings in `index.html` (3 instances) — strip; the wording carries the message. |
| 3d | Sidebar Home button: re-add a small inline SVG home glyph (or stay text-only — your call). |
| 3e | Anything missed: residual `⏭️` / `↩️` / `✏️` / `🚀` if any survived. (`console.log` emojis can stay — not user-facing.) |

**Scope**: small. Under 50 lines. Quick win.

---

## 4. Extend Edit & Resubmit to non-PR forms

Currently only Purchase Requisitions support Edit & Resubmit on My
Submissions. Extend to EFT, Petty Cash, Expense Claim.

| # | Task |
| --- | --- |
| 4a | Update `canEditResubmit` in `MySubmissions` to allow other form types. |
| 4b | Modal edit fields differ per form type — either branch by type or make the modal generic with field config per form type. |
| 4c | Resubmit endpoint per form type: PUT to `/api/forms/eft-requisitions/:id` etc. Backend needs an editAndResubmit path that clears rejection metadata. |
| 4d | Server-side: PUT routes for the forms probably allow only certain fields when status=rejected; verify and adjust. |

**Scope**: medium. ~250 lines if generic; ~500 if branched per type.

---

## 5. Dead-code prune (only AFTER #4 lands)

Once Edit & Resubmit covers all four form types, the original per-type
list components are truly redundant.

| # | Task |
| --- | --- |
| 5a | Delete `RejectedRequisitions`, `EFTRequisitionsList`, `ExpenseClaimsList`, `PettyCashRequisitionsList`, `CreateEFTRequisition`, `CreateExpenseClaim`, `CreatePettyCash`. |
| 5b | Delete corresponding view-router entries. |
| 5c | Delete backup HTML files (`index-new.html`, `index-old-backup.html`). |
| 5d | Move the EFT lockout banner (currently inside `CreateEFTRequisition`) to a tiny standalone helper so it doesn't get deleted with the parent. |

**Scope**: ~1100-line deletion. Zero functional change if (4) is solid.

---

## 6. Reports download error (bug)

Reports are throwing an error when a user attempts to download them.

| # | Task |
| --- | --- |
| 6a | Reproduce the error and capture the full stack trace / response from the server. |
| 6b | Identify root cause — likely in the PDF generation route (`backend/utils/storesPDFGenerator.js` or whichever generator handles reports), a missing asset, or a broken route. |
| 6c | Fix and verify download works end-to-end. |

**Scope**: unknown until root cause is found. Marked as bug — investigate first.

---

## Recommended order

Highest value first, increasing risk last:

1. **#3 — icon strip** (quick win, ~50 lines, immediately visible)
2. **#1 — admin EFT schedule** (meaningful feature, well-scoped, no UI palette work)
3. **#4 — extend Edit & Resubmit** (opens the door for the prune)
4. **#2 — unified dark theme** (large visual refactor; best as its own session)
5. **#5 — dead-code prune** (only after #4 reduces true redundancy)

---

## Notes / open questions

- For #2, the user previously mentioned cards should appear to "float" on a dark background through edge sharpness rather than contrasting fill. The proposed two-shade scheme (page slightly darker than card) preserves that feel.
- For #3d, deciding whether the home icon stays as text or returns as a glyph is the only open design call.
- For #1, override auto-expiry should write an audit entry of its own — TBD whether that's a scheduled job or computed at read time.
