# KẾ HOẠCH THỰC THI — Sales SUP/ASM Desktop (M0 CONTRACT REVIEW)
**Liên kết:** MASTER_PLAN.md · docs/M0_CONTRACTS.md · Issue #2 | **Giai đoạn:** M0 planning; Master Plan PR #1 đã merged, chưa cấp phép bắt đầu lập trình.
**Nguyên tắc:** Mỗi implementation Issue mở sau khi Master Plan PR được owner review/chốt; owner duyệt merge từng PR; GitHub main là nguồn chuẩn; local chỉ pull sau merge.

## Milestone 0 — Approve architecture (documentation-only)
**Đầu vào:** Repo main hiện hữu, docs/MVP_SPEC.md, SQL+contracts hiện hữu, KM repo & tài liệu license/release.
**Tasks**
- [x] Audit baseline SQL/TS và thống nhất kiến trúc một operator SALES/SUP/ASM; business rules và mapping Excel linh hoạt được owner duyệt làm baseline, mapping file thật chưa xác minh.
- [x] Chốt chính sách license: Key Manager quyết định hạn ngày/vĩnh viễn/số thiết bị/grace, Supervisor không hardcode; owner cung cấp SALESCENTER + R2 bucket/base URL.
- [ ] Verify license app_id/API/kid/clock, R2 prefix/profile và updater manifest/signature/pipeline từ staging; không nhầm owner-provided với e2e PASS.
- [x] Chốt phạm vi MVP: không backend online, không login cho nhân viên cấp dưới, không đồng bộ nhiều máy.
- [x] Master Plan PR #1 đã review, CI xanh, owner duyệt merge; main SHA 77b5f705. Owner tự đồng bộ local sau merge khi cần.
**Gate:** Master Plan đã merge và cấu trúc M0–M5/M1.1–M1.4 đã được owner đồng ý. M0 được khóa **về mặt thiết kế/tài liệu** sau PR docs review + CI PASS + owner duyệt merge và xác nhận cho phép mở Issue Sprint 1. File Excel thật là gate trước M2/M3; kiểm runtime License/R2/NSIS/updater là gate M4/M5 **sau khi có ứng dụng**, không là điều kiện bất khả thi chặn M1. Chưa tạo Issue code trước owner gate.

### Bắt buộc UI/UX Skill Gate trước mọi Issue giao diện
- [ ] Liệt kê và đọc các GPT skills khả dụng trước khi tạo/sửa UI, nhất là `professional-ui-design` và `professional-frontend-qa` nếu có. Nếu thiếu thì ghi rõ, dùng checklist manual tương đương; **không nhận đã dùng khi chưa đọc**.
- [ ] Khi thích hợp đọc `build-dashboard`, `visualize-data`, `react-best-practices` (nếu khả dụng) để kiểm KPI/dashboard, trực quan hóa và chất lượng React; vẫn giữ Fluent UI 9 đã thống nhất.
- [ ] Trong PR nêu skill thực sự đã đọc, thiết kế mẫu/tiêu chí UX, QA evidence màn hình 1366×768 và 1920×1080, accessibility/keyboard/overflow/loading/empty/errors và performance DataGrid.
- [ ] Review UI/UX theo ảnh/screen/test thực tế, không xác nhận PASS chỉ vì typecheck và build thành công.

### Sprint 1 đã thống nhất cấu trúc (chưa giao agent code)
- **M1.1:** Tauri 2 / React / Fluent UI 9 workspace + typed front-end foundation + CI frontend/Rust.
- **M1.2:** SQLite app-data, migration/rollback preflight, WAL/foreign keys, singleton operator SALES|SUP|ASM; DB tồn tại sau restart.
- **M1.3:** Typed allowlisted Tauri IPC, onboarding một operator, Windows Office shell, lỗi/empty/loading và UI skill/QA gate.
- **M1.4:** Windows NSIS installer + smoke clean install/offline/restart/uninstall dữ liệu không mất; build CI xanh trước merge.
- Mỗi phần được tách Issue sau M0, có acceptance, regressions và Windows QA. KHÔNG mở các Issue này trong PR tài liệu.

### Contract cho M4 — dẫn chiếu
- Áp dụng `docs/M0_CONTRACTS.md` làm decision register; phân biệt `OWNER-CONFIRMED`, `REPO-VERIFIED`, `PROPOSED`, `UNVERIFIED`.
- Key Manager release profile chỉ được cấu hình cho staging từ merged SHA. `pnpm run release:package`, `dist\windows-release`, `latest.json` và chữ ký là hợp đồng target/chưa triển khai, không khẳng định output đã tồn tại.
- Việc kiểm chứng manifest Tauri 2 + installer/.sig và nguyên tắc không mất SQLite là release gate. PR docs/CI baseline PASS **không tương đương** updater E2E PASS.

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
