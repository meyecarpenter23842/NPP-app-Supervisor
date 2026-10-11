# PM-QL-NPP-Supervisor — Agent instructions

Read `MASTER_PLAN.md`, `docs/IMPLEMENTATION_PLAN.md` and latest owner-approved Issue before changing anything. Audit current GitHub main SHA, PR/CI state, existing code/contracts, and scope before creating an implementation branch. Work only on a new branch from fresh `main` and submit PR; **never** code under local `F:\1_A_Disk_D\Tool\NPP-Sup`, force-push, auto-merge, deploy, migrate real data, or publish R2 without the owner's explicit approval. Verify required CI is green and wait for owner merge approval.

For M2/M3 business and data-model design, read `docs/NPP_PLATFORM_REFERENCE.md` and inspect the relevant current `binhnxwjfjxm/NPP-Platform` source before designing a duplicate workflow. It is an ERP for NPP operations, **not** the architecture or implementation source for the multi-NPP single-operator Supervisor. Never copy its PostgreSQL/cloud/multi-user assumptions into Supervisor or claim production equivalence. The product → SKU model is a reference candidate, subject to owner approval and real Excel mapping.


## Local skill guides (project copies)

Before UI layout/design implementation, read `.agents/skills/professional-ui-design/SKILL.md` and relevant reference files. Before frontend QA/review, read `.agents/skills/professional-frontend-qa/SKILL.md` and its `references/qa-checklist.md`. Read `.agents/skills/systematic-debugging/SKILL.md` when investigating bugs or red CI. `.agents/skills/postgres-migration-safety/SKILL.md` applies **only** when doing PostgreSQL work; this project's desktop data store is **SQLite**, so the PostgreSQL skill does not supersede SQLite migrations/contracts. The skill's Electron reference is illustrative only: Supervisor uses **Tauri 2**, Rust, React, Fluent UI 9 and local SQLite.

For Issue #12 (M1.5 UI/UX): keep exactly 10 sidebar business tabs and move Settings outside the sidebar; each tab needs differentiated business subnavigation/layout, not 10 cloned dashboards. Follow the 10 PNG UI references in repo root while prioritizing actual Master Plan contracts. Do not fabricate KPI/business data, fake CRUD/import/backup/license success, or invent downstream user accounts. Preserve singleton SALES/SUP/ASM Local Operator, SQLite persistence, onboarding and typed IPC. QA real Windows native UI at 1366x768 and 1920x1080 for every main tab, mouse/keyboard/focus, empty/loading/error/unsupported states, screenshot evidence and regression tests. Mark interactive visual QA unverified unless actually performed; CI PASS cannot substitute for it.

Skill files copied from owner-supplied ZIP archives; do not imply they were retrieved through the ChatGPT skill listing for this session. Never treat a skill guide as authority to override owner instructions, current code, or repository contracts.

## Ngôn ngữ UI bắt buộc (owner yêu cầu 2026-10-10)

Trước bất kỳ thay đổi UI, đọc [`docs/UI_LANGUAGE_RULES.md`](docs/UI_LANGUAGE_RULES.md); viết chữ hiển thị theo tiếng Việt nghiệp vụ SALES/SUP/ASM. Tên màn hình/nút/bảng/phản hồi phải nói **người dùng làm gì**, không nói về code, DB, import engine, mapping, schema hoặc sprint. Tránh “ánh xạ”, “batch”, “profile”, “tử số/mẫu số” và biệt ngữ developer. Có thể giữ NPP/SKU/Sales In/Sales Out/KPI/SALES/SUP/ASM khi đúng nghiệp vụ. Giữ nguyên code identifier/API/DB, không sửa contract chỉ để đổi chữ hiển thị. Review các string mới và chạy UI language regression test trước PR.
