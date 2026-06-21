# Phase 6 — Financial Forms Standardization: Master Plan

**Scope:** 6 standalone HTML form pages
`eft-requisition.html` · `petty-cash-requisition.html` · `expense-claim.html` · `issue-slip.html` · `grn.html` · `picking-slip.html`

---

## Current state (problems)

| Form | Font | Section accent | Input focus | Table header | Primary btn |
|------|------|----------------|-------------|--------------|-------------|
| EFT Requisition | Segoe UI | `#667eea` purple | `#667eea` | `#667eea` | `#0070AF` ✓ |
| Petty Cash | Segoe UI | `#667eea` purple | `#667eea` | `#667eea` | `#0070AF` ✓ |
| Expense Claim | Segoe UI | `#667eea` purple | `#667eea` | `#667eea` | `#0070AF` ✓ |
| Issue Slip | Segoe UI | `#10b981` green | `#10b981` | `#10b981` | `#10b981` |
| GRN | Segoe UI | `#d97706` amber | `#f59e0b` | `#f59e0b` | `#f59e0b` |
| Picking Slip | Segoe UI | `#6366f1` indigo | `#6366f1` | `#6366f1` | `#6366f1` |

All 6 also have: no Inter font, `#28a745` green on amount totals, `&#127968;` house emoji in nav, inconsistent label sizes, inconsistent spacing.

---

## Target state (after)

Every form shares:

| Property | Value |
|----------|-------|
| Font family | Inter (Google Fonts CDN), fallback: ui-sans-serif, system-ui, -apple-system |
| Font size | 14px body, 11px labels/headings |
| Line height | 1.5 |
| Font smoothing | antialiased |
| Section heading color | `#0070AF` |
| Section heading style | 11px, 700 weight, uppercase, 0.08em letter-spacing |
| Label style | 11px, 600 weight, uppercase, color `#2A3441` |
| Input border (default) | `#DCE4EE` |
| Input border (focus) | `#0070AF` + `rgba(0,112,175,0.12)` ring |
| Table header background | `#0070AF` |
| Table header text | `#FFFFFF` |
| Primary button | `#0070AF` → `#005A8C` hover |
| Secondary button | `#F4F7FB` bg, `#2A3441` text, `#DCE4EE` border |
| Add Row button | `#0070AF` (was green `#28a745`) |
| Amount / total display | `#0070AF` (was green `#28a745`) |
| Nav Home button | White bg, `#0070AF` border + text → inverts on hover |
| Nav Back button | White/translucent bg, `#DCE4EE` border |
| Nav emoji | Removed — `&#127968;` replaced with plain text "Home" |
| Alert success | `#D1FAE5` bg / `#065F46` text / `#6EE7B7` border |
| Alert error | `#FEE2E2` bg / `#991B1B` text / `#FCA5A5` border |
| Spinner color | `#0070AF` |
| Page background | `#0070AF` (already correct on all forms) |
| Card background | `#FFFFFF` (already correct on all forms) |

---

## Implementation approach

### Step 1 — Create `frontend/forms.css`

New shared stylesheet containing all rules listed above. This is the single source of truth for all financial form styling. Per-form differences are handled via small per-file `<style>` overrides.

### Step 2 — Update each HTML file

For every file:
1. Add Inter font `<link>` preconnect + stylesheet tags to `<head>`
2. Add `<link rel="stylesheet" href="forms.css">` to `<head>`
3. Replace the full `<style>...</style>` block with a minimal override block containing only max-width and form-specific widget styles
4. Replace `<span>&#127968;</span> Home` with plain text `Home` in the nav button

Per-file specifics:

| File | Container max-width | Unique CSS to preserve |
|------|--------------------|-----------------------|
| `eft-requisition.html` | 800px | Bordered `.form-section` box style (padding + border + bg); inline (non-fullscreen) `.loading`; `#eftLockBanner` moved to forms.css |
| `petty-cash-requisition.html` | 900px | Inline `.loading` only |
| `expense-claim.html` | 1200px | Inline `.loading`; `.amountDue` color changed to `#0070AF` |
| `issue-slip.html` | 1000px | `.grn-info-banner`, `.grn-reservation-warning`, `.avail-badge`; fullscreen loading overlay |
| `grn.html` | 1000px | `.pr-info-box`; fullscreen loading overlay |
| `picking-slip.html` | 1000px | `.info-banner`; fullscreen loading overlay |

---

## What is NOT changing

- All JavaScript logic — no JS changes
- HTML structure and element IDs — no structural changes
- Auth gate scripts — untouched
- Backend routes and API calls — untouched
- Page background color (`#0070AF`) — already correct on all forms
- EFT lock banner business logic — JS untouched, only CSS moved to forms.css

---

## File checklist

- [ ] `frontend/forms.css` — create
- [ ] `frontend/eft-requisition.html` — update
- [ ] `frontend/petty-cash-requisition.html` — update
- [ ] `frontend/expense-claim.html` — update
- [ ] `frontend/issue-slip.html` — update
- [ ] `frontend/grn.html` — update
- [ ] `frontend/picking-slip.html` — update
