# KẾ HOẠCH THỰC THI — Sales SUP/ASM Desktop (DRAFT FOR OWNER REVIEW)
**Liên kết:** MASTER_PLAN.md | **Giai đoạn:** PLANNING; chưa cấp phép bắt đầu lập trình.
**Nguyên tắc:** Mỗi implementation Issue mở sau khi Master Plan PR được owner review/chốt; owner duyệt merge từng PR; GitHub main là nguồn chuẩn; local chỉ pull sau merge.

## Milestone 0 — Approve architecture (documentation-only)
**Đầu vào:** Repo main hiện hữu, docs/MVP_SPEC.md, SQL+contracts hiện hữu, KM repo & tài liệu license/release.
**Tasks**
- [ ] So sánh nguồn hiện hữu với Master Plan: operator role SALES/SUP/ASM, singleton, nhân viên chỉ là master data, lịch sử tổ chức; chốt field mapping và nguồn KPI.
- [ ] Chốt license app_code/device/offline grace, R2 release manifest/update signature, staging build không mutate bản main local.
- [ ] Chốt phạm vi MVP: không backend online, không login cho nhân viên cấp dưới, không đồng bộ nhiều máy.
- [ ] Review PR Master Plan và required CI xanh; owner duyệt merge; owner kéo main về local khi cần.
**Gate:** Master Plan đã được owner duyệt và merge + acceptance/KPI definitions thống nhất. Không tạo Issue code trước gate.

## Milestone 1 — Foundation native Windows (Issue triển khai riêng sau gate)
**Deliverables:** Tauri 2, React/Vite/TS/Fluent UI v9, Rust business service via Tauri commands, SQLite migrations, local operator 1 record (SALES|SUP|ASM), navigation + empty state + settings.
**Tasks**
- [ ] Thiết lập project layout apps/desktop, crates nghiệp vụ/storage/import, contracts tests.
- [ ] App data directory Windows theo user, khóa single-process/SQLite WAL + foreign keys, crash-safe SQLite migration and backups.
- [ ] Thiết kế explicit Rust IPC allowlist, không expose SQL/raw paths/shell; typed error envelope.
- [ ] Giao diện shell Office-style, màn hình lần đầu để tạo **01 operator**, không có create/login subordinate.
- [ ] CI Ubuntu frontend + Windows Rust fmt/check/test, installer build smoke.
**Acceptance**
- [ ] Cài được trên Windows sạch không cần Node/Python/Postgres; mở offline, tạo 1 operator.
- [ ] DB lưu sau restart và ở app-data; tạo operator thứ 2 bị chặn; user role SALES hợp lệ.
- [ ] Không chạy service bên ngoài; không có secret trong bundles.

## Milestone 2 — Master data, hierarchy & import engine
**Deliverables:** NPP, SKU/UOM/alias, employee/manager history, territory/routes, Excel/CSV import mapping, audit batch revision.
**Tasks**
- [ ] Thiết kế migrations forward-only từ SQL baseline; kiểm tra upgrade từ DB cũ và clean install.
- [ ] Hierarchy validity over time: parent manager, role, effective range, no cycles, no overlapping active assignments.
- [ ] Employee code alias theo NPP, thay manager lịch sử không hồi tố sai; mapping theo business_date.
- [ ] Rust Excel CSV parser; sheet mapping, preview/validation/error workbook, SHA256 duplicate, source_row & source_sheet.
- [ ] Staging/commit atomic, supersession/revision, periodic XNT overlap validation, clear unknown employee lane.
**Acceptance**
- [ ] Không gán nhầm doanh số giữa NPP khi mã nhân viên trùng; staff không tạo login.
- [ ] Import lại y hệt không tăng số; import sửa thay đúng batch, vẫn có audit.
- [ ] Mỗi lỗi import chỉ rõ sheet, row, column; không mất dữ liệu nếu rollback.

## Milestone 3 — Sales In/Out, XNT, Target/KPI, UI reports
**Deliverables:** Dashboard + Sales In/Out, XNT/DOH, NPP, Staff hierarchy, SKU, KPI, Reports, source drill-down.
**Tasks**
- [ ] Dùng canonical financial/quantity rules trong Master Plan (VND integer, micro-unit, signed returns).
- [ ] Chỉ lấy active batch, không cộng snapshot giữa kỳ; tính stock variance và warnings.
- [ ] KPI by NPP, Sales, SUP snapshot-by-date/manager tree; orphan/unknown staff bucket và reconciliation với NPP total.
- [ ] Dataset status/filters/as-of date, Excel export including provenance & data completeness flags.
- [ ] Test multi-NPP mixed codes, cross-period transfers, historical manager changes, incomplete XNT.
**Acceptance**
- [ ] NPP total = summed assigned Sales + unassigned sales for same scope, no double count.
- [ ] Historical SUP report không thay khi chuyển Sales sang SUP khác sau kỳ.
- [ ] Missing inputs không hiện fake zero; drill down từ KPI đến source row.

## Milestone 4 — License/Key Manager, R2 update & local data safety
**Deliverables:** Client activation/validation/heartbeat with Key Manager, bounded offline signed entitlement, KM release profile and app updater, backup restore, migration-safe install.
**Tasks**
- [ ] Audit public API contract, errors, app_id/app_code/device constraints, offline_valid_until, server trusted time, key rotation.
- [ ] Credential handling: client only public keys; no Key Manager admin secrets, DB URL or R2 credentials.
- [ ] Add release recipe for Key Manager external app flow using **throwaway staging checkout** from approved main SHA.
- [ ] Define update manifest compatibility (SemVer, checksum, Authenticode signature, notes, artifact url); upload artifacts then pointer last.
- [ ] Client manually checks/optionally downloads manifest with HTTPS; validates integrity/signature before install and closing DB; restart verification.
- [ ] Test SQLite backup/restore, schema downgrade guards, migration failure and interrupted update.
**Acceptance**
- [ ] App operations offline within license grace; after grace expiry prompts online verification without deleting business data.
- [ ] Không mất database khi cập nhật app; file installer trong R2 không chứa DB hoặc user exports.
- [ ] Build từ merged SHA không làm bẩn thư mục local sync; no R2 publish without owner release approval.

## Milestone 5 — Windows E2E / shipping gate
- [ ] End-to-end các file mẫu và file thực tế đã ẩn thông tin; offline first-run; import/reimport/rollback.
- [ ] 100k-row volume benchmark trên máy Windows VP, điều kiện đo ghi rõ trong CI/test report; virtualized grid, không khóa UI.
- [ ] Reinstall/update version N→N+1 với DB có thật mô phỏng và fail recovery; clean installer WebView2 availability.
- [ ] License online/offline/expired/revoked flows, minimum version and key rotation tests.
- [ ] Full Windows signed installer + security review + R2 dry-run/sandbox smoke trước phát hành.
- [ ] Owner nghiệm thu, CI xanh, approve merge, release riêng.

## Required quality checks & PR protocol
- Contract/schema/migration smoke + fixture reconciliation, frontend lint/typecheck/test/build, Rust fmt/check/unit/integration, Windows NSIS build, installer/updater E2E as applicable.
- CI failure: thu log, tìm nguyên nhân gốc, sửa một batch trong phạm vi; không bypass.
- Issue gọn theo vertical slice sau approval; mỗi issue ghi: bối cảnh, scope, non-goals, input/output, migrations, test plan, acceptance, impact & rollback.
- Merge chỉ khi owner yêu cầu rõ; release R2 và migrate dữ liệu người mua là operation riêng.

## Planned implementation issues AFTER owner approved Master Plan
1. Windows foundation / singleton operator / SQLite migrations.
2. Employee hierarchy + master mapping + import engine.
3. Sales/XNT/Target/KPI + multi-NPP dashboard and export.
4. Key Manager license integration + external release profile + R2 updater.
5. Windows QA + safe upgrade + release acceptance.

## Explicit exclusions
- Subordinate user accounts/passwords/HRM; shared backend/DB; multi-seat synchronization; automatic merge/deploy; direct production DB modifications.
- No app implementation, Key Manager code change, CI feature omission, or R2 upload in Master Plan PR.
