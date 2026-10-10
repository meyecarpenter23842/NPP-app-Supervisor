# M1.5 — UI/UX review checklist (Issue #12)

## Source and skill gate
- Baseline: merged main after PR #13 (`3871a3502229ff3c2874fd12bcf92c834c4c9c62`); implementation on `feat/issue-12-uiux-10-tabs` only.
- Owner-approved issue: #12. Primary contract: `MASTER_PLAN.md`; frontend stack stays Tauri 2 + React + Fluent UI 9.
- Skills read from repository: `.agents/skills/professional-ui-design/SKILL.md` and its `visual-direction`, `design-system`, `enterprise-erp`, `electron-desktop`, `visual-review` references; `.agents/skills/professional-frontend-qa/SKILL.md`, `references/qa-checklist.md`.
- No business engine, backend API, storage schema, fake records, employee logins, Key Manager release or R2 update in this PR.

## Design direction
Compact, calm, data-first desktop workbench. Neutral canvas and light surfaces, deep-slate header, restrained blue navigation accent, consistent 8px rhythm and readable Vietnamese Segoe UI. Tables and master-detail views prioritize information rather than generic dashboard cards. Per-tab subnavigation is keyboard-operable with arrow/Home/End keys.

## Code evidence / functional scopes
- 10 sidebar pages (Settings only in profile menu), with 3–4 secondary screens each.
- Per-screen content differentiates import mapping, Sales In invoices/SKU, Sales Out attribution/unassigned, period XNT, NPP master-detail, staff hierarchy/effective dates, KPI scope, SKU analysis and reports.
- Business actions without corresponding Rust implementation are intentionally absent or disabled and labeled `Chưa hỗ trợ`. All numbers absent when no data; em-dash means unknown, not 0.
- Profile editing still uses existing `OperatorForm` and `onUpdate` typed IPC. Startup and onboarding remain unchanged.
- Responsive styling uses overflow on data tables; focus-visible and tablist semantics explicitly specified.

## Acceptance matrix — complete before merge
| Check | Current status | Evidence required |
|---|---|---|
| 10 sidebar tabs; Settings outside nav | CODED; CI confirmation pending | Unit + interactive nav |
| Different layout and sub-navigation for all tabs | CODED; visual QA pending | 10× screenshots at 1366×768 and 1920×1080 |
| Focus, mouse, keyboard, Tab, arrow, Home, End | CODED; native QA pending | Windows interaction report |
| No clipped Vietnamese text/overflow | UNVERIFIED | Resize and zoom on Windows |
| Error, loading, empty, unsupported states | CODED in applicable paths; visual QA pending | Screenshots for representative states |
| No invented KPI/import/export/backup/license | CODE-REVIEW REQUIRED | Diff and behavior inspection |
| Existing operator save/SQLite/IPC regression | CODE-REVIEW REQUIRED | Existing Rust+frontend tests, restart/save on native Windows |
| Frontend lint/typecheck/tests/build | PENDING | GitHub workflow PASS |
| Windows Rust + installer smoke | PENDING | GitHub workflow PASS |
| Owner visual approval | PENDING | Native Windows screenshots reviewed by owner |

**Important:** GitHub compilation is NOT native Windows visual verification. Do not merge Issue #12 PR until the native 1366×768 and 1920×1080 screenshots and operator interaction QA have been provided and approved.
