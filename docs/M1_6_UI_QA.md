# M1.6 — UI polish evidence / owner QA (Issue #15)

## Baseline / scope
- Branch `feat/issue-15-ui-polish-density` from `main` `0c49bafc26d881a61f3a48cee371bfa2b40df828` (M1.5 merged).
- Owner's Windows screenshots: page + filter header oversized, flat all-white page, sidebar without sufficient visual identity.
- Used the owner-provided repository skills: `.agents/skills/professional-ui-design/SKILL.md`, `references/design-system.md`, `.agents/skills/professional-frontend-qa/SKILL.md`, `references/qa-checklist.md`.
- No modifications to Rust, SQLite, IPC, onboarding, import logic, licensing, backups, updater or R2.

## Design decisions
- **Compact, precise, calm:** keep Segoe UI / Fluent 9 and existing deep-blue identity.
- **Sidebar:** deep slate-blue surface, muted group headers, high-contrast navigation, selected white-blue item with slim accent and visible keyboard focus.
- **Content:** cool light canvas around white tables and panels, subtle border/shadow only on true distinct surfaces; improved table headings and empty-state tint.
- **Reduced height:** page title and supporting text are condensed, redundant category eyebrow and status caption removed (breadcrumb and status remain). Filter panel uses horizontal label/control pairs, less padding and shorter missing-data hint. Secondary navigation and empty tables use compact spacing.
- **Narrow windows:** scrollable horizontal navigation retained; controls stack only on small widths. Controls remain disabled until business data is available.

## QA matrix (do not claim PASS without observation)
| Check | Status at implementation | Evidence needed |
|---|---|---|
| 10 sidebar tabs and Settings menu preserved | Code-preserved; automated test required | Frontend test / native click-through |
| Sidebar contrast and keyboard focus | CSS coded; unverified visually | Windows screenshot/keyboard traversal |
| Header/filter compact with labels | CSS + JSX coded | Windows screenshots at 1366×768 and 1920×1080 |
| Canvas/panel/table visual differentiation | CSS coded; unverified visually | Compare owner M1.5 screenshot with native M1.6 |
| Tab/subtab and scroll/resize behavior | Code unchanged, CSS refined | Test mouse/Tab/arrows, resize/high DPI |
| Empty/unsupported states show no fake business values | Existing component code untouched | UI screenshot + test |
| Operator update/onboarding + SQLite | Code untouched | Native save/restart check |
| Required frontend/Windows/SQLite CI | **Pending PR CI** | GitHub check links |
| Owner acceptance | **Pending** | Owner review of native Windows output |

**Release boundary:** This is a UI-only PR. CI passing is not proof of Windows visual QA; owner controls merge and no production/R2 action is included.
