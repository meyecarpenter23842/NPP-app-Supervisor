# M1.3 QA — Windows Office shell

## Skill gate
- Sources read: MASTER_PLAN.md, docs/IMPLEMENTATION_PLAN.md, docs/M0_CONTRACTS.md, Issue #6, M1.2 code.
- react-best-practices: available and read from Vercel plugin; principles applied to effect cancellation, static nav arrays, typed events and error states.
- professional-ui-design: NOT AVAILABLE.
- professional-frontend-qa: NOT AVAILABLE.
- Manual design: Fluent UI 9/Segoe, clear labels, keyboard focus/Tab, empty/loading/error/saving, responsive overflow.

## Flow
- First run: health + get_operator, then one SALES/SUP/ASM local operator.
- Restart: existing operator is loaded, no second onboarding; Settings **updates** the same DB row.
- Native allowlist: health/get_operator/create_operator/update_operator. No arbitrary SQL, filesystem access, process/shell, external API, credential or local login.
- App sections: Overview, Import, Sales In, Sales Out, XNT, NPP, Team, KPI/Target, SKU, Reports, Settings. Every data page shows clear missing-data placeholders.

## Evidence / open QA
- CI test/build evidence: record run IDs and outcomes in PR.
- 1366×768/1920×1080 interactive native Windows screenshot, resized window, zoom, keyboard/focus traversal, onboarding error, role change and offline restart: UNVERIFIED until tested interactively; do not equate executable compilation with visual QA PASS.
- No real NPP data or production migrations used.
