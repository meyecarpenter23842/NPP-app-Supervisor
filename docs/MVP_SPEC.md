> **CHÚ Ý — Thiết kế baseline chưa cập nhật (2026-10-10).** [MASTER_PLAN.md](../MASTER_PLAN.md) là nguồn ưu tiên; các quyết định M0 đã chốt và các phần còn chờ xác minh xem [M0_CONTRACTS.md](M0_CONTRACTS.md). Người mua chỉ có **một Local Operator** loại SALES/SUP/ASM; employees và SUP dưới quyền chỉ là dữ liệu kinh doanh, KHÔNG có login. Backend + SQLite hoàn toàn cục bộ theo bản cài; Key Manager License API / R2 chỉ dùng cho license và phát hành bản cập nhật. Bảng Persona, Role TypeScript và app_profiles trong baseline bên dưới chưa phù hợp và phải sửa ở các Issue triển khai sau gate Master Plan. [Kế hoạch thực thi](IMPLEMENTATION_PLAN.md).
>
# Sales SUP/ASM Desktop — MVP v1.0

**Trạng thái:** Architecture baseline / handoff for implementation.  
**Phạm vi:** Windows desktop, offline-first, Excel/CSV-first, multi-distributor FMCG supervision.  
**Tài liệu tham khảo:** https://github.com/binhnxwjfjxm/NPP-Platform  
**Ngày thiết kế:** 2026-10-10 (Asia/Ho_Chi_Minh).

## 0. Tóm tắt quyết định

- Tạo **repository độc lập**, không thêm backend hay chỉnh sửa production NPP-Platform.
- Desktop Tauri 2 + Rust, React + Vite + TypeScript, Fluent UI React 9, TanStack Table, ECharts.
- **Không yêu cầu Internet**, không có server cho MVP. Dữ liệu SQLite 3 tại profile Windows hiện tại.
- Import/validate/commit, tính toán/summaries và export do lớp Rust thực hiện; React chỉ giao tiếp với các command an toàn đã định nghĩa.
- Đọc Excel `.xlsx`/CSV. Parsing Rust (`calamine` cho Excel, `csv` cho CSV), xuất Excel (`rust_xlsxwriter` hoặc thư viện xuất tương đương sau khi spike API), SQLite qua `rusqlite` và migrations SQL versioned.
- Không tự động hợp nhất database giữa các máy ở MVP. File chuyển máy chỉ qua chức năng backup/restore có kiểm tra.
- Tất cả dữ liệu doanh số, tồn kho, KPI có `import_batch_id` và `source_row` để truy xuất file gốc.
- Những chỉ số chưa có nguồn hợp lệ phải hiển thị **Chưa đủ dữ liệu**; không tự suy đoán là 0.

## 1. Personas & permissions

| Persona | Khối công việc | Dữ liệu mặc định |
|---|---|---|
| SUP | Kiểm soát 1/nhiều NPP, NVKD, SKU, tuyến | Chỉ các NPP được cấu hình phụ trách |
| ASM | So sánh nhiều NPP và SUP, chỉ tiêu khu vực | Toàn khu vực được cấu hình |
| Local owner | Nhập Excel, quản trị mapping, sao lưu/phục hồi | Một Windows user profile duy nhất |

**Ranh giới an ninh:** Trong phiên bản offline mỗi Windows profile có dữ liệu riêng. Vai trò SUP/ASM quyết định bộ lọc và chức năng trong app, **không tương đương** bảo mật phân quyền máy chủ. Không hứa hẹn bảo vệ bí mật giữa nhiều Windows administrators trên một máy. Cần triển khai auth server và kiểm tra scope ở backend nếu có môi trường dùng chung nhiều tài khoản sau này.

## 2. Phạm vi P0 & không làm

### Must-have P0
1. First-run/setup, profile SUP/ASM, cấu hình timezone (`Asia/Ho_Chi_Minh`) và ngày làm việc.
2. Master NPP/territory, SKU + đơn vị chuẩn, NVKD + phân công theo thời gian.
3. Import Center có mapping cột, preview, issues, duplicate/revision/supersession, audit.
4. Sales In, Sales Out theo thời gian/NPP/SKU; Sales Out theo NVKD khi có dữ liệu gắn nhân viên.
5. XNT theo period, kiểm tra chênh lệch tồn; DOH chỉ tính khi có coverage ngày/kỳ phù hợp.
6. Targets theo tháng (NPP hoặc NVKD), KPI, progress; không cộng hai cấp target vào nhau.
7. Dashboard lọc kỳ/NPP + báo trạng thái dữ liệu và drill-down.
8. Export Excel/CSV, backup/restore, tùy chọn quy tắc cảnh báo cơ bản.
9. Test tính toán, test nhập trùng file, test snapshot không cộng dồn, nghiệm thu dataset chuẩn.

### Out of scope P0
- Đồng bộ trực tuyến/API NPP, đa thiết bị, đồng chỉnh sửa, real-time push.
- CRUD kho hoặc chứng từ gốc NPP, hạch toán kế toán, GPS/check-in, trả lương.
- AI agent/forecast machine learning; chỉ forecast rule-based ở giai đoạn sau.
- Approval workflow đa người và phân quyền tin cậy giữa các người dùng chung database.
- App cho điện thoại / macOS. Nền tảng có thể mở rộng sau.

## 3. Ngữ nghĩa dữ liệu & KPI (bất biến)

### 3.1 Sales In
**Business definition (MVP):** trị giá hóa đơn công ty bán vào NPP, đã ghi nhận; trả hàng/credit note được trừ, theo **ngày chứng từ**. `sales_in_facts` dùng loại `INVOICE` (+) và `RETURN` (-). Không sử dụng Sales In thay cho nhập kho thực tế. Nếu nguồn Excel là đơn đặt hàng/đơn chưa giao thì **không nhận** vào dataset Sales In, phải phân loại khác.

### 3.2 Sales Out
**Business definition (MVP):** doanh số NPP bán ra điểm bán đã giao/ghi nhận, trừ hàng trả lại, theo **ngày nghiệp vụ**. `DELIVERED` (+), `RETURN` (-). Đơn nháp, chưa giao, hủy không được nhập vào số thực hiện. Nếu Excel chỉ là dữ liệu hóa đơn, cấu hình dữ liệu phải ghi rõ tiêu chuẩn ghi nhận và hiển thị nguồn, không ngầm khẳng định là số đã giao.

### 3.3 XNT
**Business definition:** báo cáo tồn kho do NPP cung cấp cho một kỳ xác định (có ngày bắt đầu và kết thúc), chứa tồn đầu, nhập thực nhận, xuất kho thực, điều chỉnh, tồn cuối. `expected_closing = opening + receipts - issues + adjustments`. `variance = expected_closing - declared_closing`. Mọi số lượng ở **đơn vị cơ sở SKU**. Khoảng kỳ trùng/chồng lấn cho một NPP phải được từ chối hoặc thay thế đúng cùng slot theo thủ tục duyệt. **Không cộng tồn cuối qua các kỳ**, và không lấy doanh thu Sales In/Out để tự sửa XNT.

### 3.4 Định dạng và quy đổi
- Mọi ngày nguồn: ISO `YYYY-MM-DD`, kỳ target: `YYYY-MM-01`; hệ thống mặc định timezone nghiệp vụ `Asia/Ho_Chi_Minh`.
- Tiền: **VND integer**, không dùng JS float làm nguồn tính toán; nếu cần giá trị tiền khác VND => tạm reject ở MVP.
- Số lượng: integer micro (`10^6` đơn vị cơ sở). Parser đọc decimal chính xác; alias unit chuyển theo tỷ số nguyên numerator/denominator; nếu vượt độ chính xác hoặc integer range => lỗi có thể giải thích.
- Không lấy tên SKU/NPP/NVKD làm khóa join; khóa chuẩn là code đã normalize, có mapping alias theo NPP, có lịch sử hiệu lực.
- Mã `00123` phải lưu text và giữ nguyên số 0; không tự ép sang số, không bỏ khoảng trắng bên trong mã.
- Trả hàng phải là dòng âm cho quantity và amount; dòng dương với `RETURN` => lỗi.

### 3.5 KPI formulas
`sales_in_actual = SUM(quantity/amount signed from ACTIVE Sales In batches)`.

`sales_out_actual = SUM(amount signed from ACTIVE Sales Out batches)`.

`achievement_pct = actual / target * 100` khi `target > 0`, nếu target = 0 thì `N/A`.

`stock_variance = opening + receipts - issues + adjustments - closing` tính theo `(npp,sku,period)`.

`avg_daily_out_qty = SUM(issued_base_qty across compatible observation window) / observed_days`, chỉ khi dữ liệu kỳ đầy đủ và không overlap.

`DOH = latest_valid_closing_qty / avg_daily_out_qty`; nếu mẫu số = 0 => `Không có tốc độ xuất`, không hiển thị `0 ngày` hoặc vô cực.

`estimated_month_end_sales_out = actual_to_date / elapsed_selling_days * planned_selling_days` (P1, chỉ khi có lịch bán hàng và đủ dữ liệu). Gắn nhãn `Dự báo theo tốc độ hiện tại`, không coi là doanh số chắc chắn.

**Cấm cộng target cấp NPP với tổng target cấp NVKD** khi trình bày cùng cấp. Chọn một grain tham chiếu rõ ràng và cảnh báo nếu tổng không khớp.

**Completeness:** mọi KPI theo NPP/period có `source_status`: `VALID`, `PARTIAL`, `MISSING`, `STALE`, `CONFLICT`. `MISSING` ≠ zero.

## 4. Database design — SQLite

Script runnable: `../database/001_initial_schema.sql`.

### Entities
- Master data: `territories`, `distributors`, `employees`, `employee_distributor_assignments`, `routes`, `outlets`, `products`, `sku_aliases`.
- Import: `import_profiles`, `import_batches`, `import_issues`.
- Facts: `sales_in_facts`, `sales_out_facts`, `inventory_period_facts`, `target_facts`.
- Operational: `app_profiles`, `period_closures`, `app_settings`, `audit_events`, `schema_migrations`.
- Views: `v_active_sales_in`, `v_active_sales_out`, `v_active_inventory_period`, `v_active_targets`.

### Contract import batch
- Mỗi batch đại diện một `(kind, distributor, exact reporting period)`; một file đa NPP phải chia batches.
- `active=1` chỉ với batch `COMMITTED`.
- Import slot cũ cùng kỳ bị `SUPERSEDED`/`active=0` trước khi phiên bản mới được `COMMITTED` trong cùng SQLite transaction.
- Phòng chống chồng kỳ (khác start/end) và dữ liệu `TRANSACTION` vs `DAILY_SUMMARY` cùng phạm vi bằng kiểm tra code import trước commit (partial unique index chỉ bảo vệ **exact slot**).
- Ngăn duplicate file theo `SHA-256` + kind/scope/period (mở xem lịch sử, không tự tăng doanh số).
- Không xóa batch cũ; dữ liệu facts vẫn liên kết batch để audit, view active lọc bản hiệu lực.
- Khi sửa mapping hoặc nhập lại lịch sử, không mutate in-place facts; tạo phiên bản batch mới.

### Lưu ý kỹ thuật schema
- Các ràng buộc cross-row như `employee assignment overlaps`, `alias overlaps`, `XNT period overlaps` và `period closed` thực hiện ở service layer trong một transaction kiểm tra + ghi, có tests hồi quy. Unique indexes đơn thuần không kiểm được overlap.
- Ngoài SQL schema, lưu nguyên gốc Excel/CSV vào thư mục archive của user **nếu user cho phép**, hash kiểm tra tính toàn vẹn và không đưa tệp vào backup tạm khi chưa đồng ý. Thư mục archive có thể tốn dung lượng.
- Chạy `PRAGMA foreign_keys=ON` mỗi connection, bật WAL ở initialization, `busy_timeout`, `integrity_check`, migrations trước UI.
- `VACUUM`/checkpoint theo maintenance, không làm ngắt UX; đọc qua views hoặc chỉ số indexed, paging/virtualization ở bảng lớn.

## 5. Import Center — workflow và giao dịch

```text
(1) Choose File(s) [xlsx/csv]
  -> (2) Identify data type + source NPP + period
  -> (3) Detect sheet, header row, map columns / save profile
  -> (4) Preview 50 sample rows
  -> (5) Parse full file to staging, SHA-256, normalize dates/IDs/decimal/unit
  -> (6) Validate: schema -> reference keys -> business states -> duplicates -> overlaps -> reconciliation
  -> (7) Display ERROR/WARNING by sheet/row/column + export issue report
  -> (8) Confirm import scope, total row count, summed totals, replaced dataset slot
  -> (9) One SQLite transaction: supersede old batch, insert new facts, mark active, audit
  -> (10) Refresh report query and show provenance link
```

Errors blocking: không xác định NPP/SKU; ngày lỗi; mã thiếu; giá trị tiền/đơn vị sai; chồng kỳ; duplicate document line; return sai dấu; `XNT variance != 0` (có thể cho phép ngoại lệ sau này theo policy); chốt kỳ. Warning: thiếu employee cho Sales Out; mã outlet rỗng; số liệu doanh số kỳ so với các nguồn khác chênh lệch; file cũ hơn kỳ đang quản lý.

**Rollback/commit:** Nếu lỗi bất kỳ ở bước (9), toàn bộ thay đổi phải rollback, active batch cũ giữ nguyên. Chỉ report sau successful commit. Thao tác hủy giữa chừng phải dọn staging, không đụng fact đã chốt.

**Large file:** Đọc tại Rust background worker để không block UI, giới hạn dung lượng và rows cấu hình. Mục tiêu thử nghiệm: 100k dòng Sales Out ở máy office 8GB RAM (phải benchmark; không cam kết tốc độ khi chưa đo). Nếu file quá lớn, khuyến nghị chia nhỏ theo kỳ/NPP.

### Excel file contract

Workbook mẫu: `../templates/SALES_SUP_ASM_IMPORT_TEMPLATES.xlsx`. Header luôn ở dòng 1, dữ liệu từ dòng 2. ISO dates, text codes, VND integer; dữ liệu minh họa không phải thật.

| Kind | Bắt buộc | Tùy chọn |
|---|---|---|
| NPP | NPP_CODE, NPP_NAME, TERRITORY_CODE | STATUS |
| SKU | SKU_CODE, SKU_NAME, BASE_UNIT | CATEGORY |
| EMPLOYEE | EMP_CODE, FULL_NAME, ROLE, NPP_CODE, EFFECTIVE_FROM | EFFECTIVE_TO |
| SALES_IN | BUSINESS_DATE, NPP_CODE, SKU_CODE, RAW_UNIT, QTY, DOC_TYPE, NET_AMOUNT_VND | DOCUMENT_NO, LINE_NO |
| SALES_OUT | BUSINESS_DATE, NPP_CODE, SKU_CODE, RAW_UNIT, QTY, DOC_TYPE, NET_AMOUNT_VND | DOCUMENT_NO, LINE_NO, EMP_CODE, OUTLET_CODE, ROUTE_CODE |
| XNT | PERIOD_FROM, PERIOD_TO, NPP_CODE, SKU_CODE, RAW_UNIT, OPENING_QTY, RECEIPTS_QTY, ISSUES_QTY, ADJUSTMENTS_QTY, CLOSING_QTY | - |
| TARGET | MONTH_START, METRIC, SCOPE, NPP_CODE, TARGET_VND | EMP_CODE (required when SCOPE=REP) |

### Required import order
1. NPP/territory, SKU + units, EMPLOYEE + assignments.
2. Targets.
3. Sales In/Sales Out.
4. XNT.
5. Dashboard/reporting.

## 6. Screen specification

### UI design system
- Default light theme, navy topbar, warm-gray workspace, subtle border, system Segoe UI variable/Fluent tokens; do not hardcode custom colors in most components.
- Responsive **desktop first**, designed for 1366x768 and 1920x1080; min effective area 1150x700.
- Left nav 236px expanded / 64px collapsed. Fixed topbar 52px, filterbar 56px.
- DataGrid virtualized, sortable, sticky headers, adjustable columns, keyboard selection, column visibility, pagination or virtual infinite read; never mount 100k DOM rows.
- Numbers `vi-VN`, VND `1.234.567 ₫`, quantity decimal max 3 on display unless more precision needed, date `dd/MM/yyyy` on display (ISO storage).
- Empty vs loading vs error vs missing source vs reconciliation issue must be distinguishable.
- Global filter: from/to, NPP multi-select, territory, SKU group; persisted per profile (not as KPI truth).

### Navigation
```text
Sales SUP/ASM
  Tổng quan
  Dữ liệu & Import
  Doanh số
    Sales In
    Sales Out
    Phân tích chênh lệch
  Hàng tồn kho
    XNT
    DOH / tồn bất thường
  Nhà phân phối
  Đội ngũ kinh doanh
  Chỉ tiêu & KPI
  Phân tích SKU
  Báo cáo
  Cấu hình & Sao lưu
```

### Screen details

1. `dashboard`: KPI Cards (SI, SO, KPI %, stock DOH when valid), trend by day/week, ranking NPP, exceptions, last import freshness; click leads to detail filtered.
2. `imports`: batch ledger, file picker, wizard, sheet/header mapping, preview, issue explorer, commit, history, replaced revisions, provenance inspection.
3. `sales-in`: table NPP x period, SKU drill-down, invoice/return reconciliation, period compare, export.
4. `sales-out`: table NPP x SKU x NVKD x period, trend, negative returns, optional outlet drill-down.
5. `xnt`: NPP/SKU/period table, opening-in-out-adjust-closing-variance, nonoverlap rule, stale warning, DOH only when valid.
6. `distributors`: NPP master, latest available period, SI/SO, performance, inventory, completeness.
7. `team`: employee + assignment effective dates, rep KPI if source has REP, missing mapping queue.
8. `targets`: import, monthly grid, scope NPP vs REP toggle, actual/target/% variance, show only appropriate aggregation.
9. `sku`: compare performance and stock per NPP; never sum heterogenous SKU quantities.
10. `reports`: choose dataset period/granularity, exports with metadata timestamp/filter/source batches.
11. `settings`: local profile, timezone fixed (MVP), import mapping profiles, DOH thresholds, work calendar, backup/restore/integrity check.

### Sample layout
```text
┌────────────────────────────────────────────────────────────────────────────┐
│ SALES SUP/ASM      Tổng quan khu vực       [Kỳ ▼] [NPP ▼] [Tìm kiếm...]   │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Tổng quan    │  Sales In     Sales Out      KPI SO       Ngày tồn          │
│ Dữ liệu      │  12,4 tỷ      10,8 tỷ        87%          24 ngày          │
│ Doanh số     │────────────────────────────────────────────────────────────│
│ XNT          │  Doanh số theo thời gian      Cảnh báo dữ liệu              │
│ NPP          │  [Chart]                     [Lệch XNT: ...]               │
│ Nhân viên    │────────────────────────────────────────────────────────────│
│ KPI          │  NPP          Sales Out      KPI %        Freshness         │
│ SKU          │  ...          ...            ...          ...               │
│ Báo cáo      │                                                            │
│ Cấu hình     │  [Nguồn dữ liệu: kỳ/loại/import batch]                      │
└───────────────┴────────────────────────────────────────────────────────────┘
```

## 7. Rust <-> React boundary

All commands typed using TS interfaces and Rust `serde` DTOs, whitelist only business operations. Suggested MVP commands:

| Command | Request | Response |
|---|---|---|
| `get_dashboard` | dateRange, nppIds | KPI cards + provenance + data states |
| `list_distributors` | search, active | paged NPP DTO |
| `list_sales_in` | dates, dims, paging, sorting | rows + totals + freshness |
| `list_sales_out` | dates, dims, paging, sorting | rows + totals + freshness |
| `list_inventory` | periodEnd, nppIds, paging | latest eligible XNT rows + variances |
| `list_kpi` | month, scope, nppIds | actual/target/% per grain |
| `pick_import_file` | none | OS-file chosen path/token |
| `preview_import` | picked path, kind, mapping | preview, errors, detected metadata |
| `validate_import` | stagedImportId | issues, totals, overlap/duplicate verdict |
| `commit_import` | stagedImportId, explicit replace policy | batchIds, counts, provenance |
| `export_report` | report kind, filters, destination | saved file info |
| `create_backup` | destination, options | integrity, backup manifest |
| `restore_backup` | file, explicit confirmation | restore summary + restart request |

Never expose `execute_sql`, arbitrary filesystem read, `shell.open`, or unrestricted sidecar execution to browser JS. Persisted queries must use prepared statements and controlled sorting column whitelist. Import file selection via native dialog; Rust validates canonical path and file type/size before parse.

## 8. Directory structure

```text
Sales-Supervisor-Desktop/
├── apps/desktop/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── app/ (router, store, shell, theme)
│   │   ├── features/ (dashboard, imports, sales, inventory, npp, team, targets, sku, reports, settings)
│   │   ├── components/ (tables, filters, cards, status, dialogs)
│   │   ├── contracts/ (typed DTOs + invoke wrappers)
│   │   └── styles/
│   └── src-tauri/
│       ├── tauri.conf.json
│       ├── capabilities/default.json
│       └── src/
│           ├── main.rs, lib.rs
│           ├── commands/
│           ├── import/ (parse, map, validate, commit)
│           ├── domain/ (money, quantity, calendar, metrics)
│           ├── db/ (connection, migrations, repositories)
│           ├── reports/
│           ├── backup/
│           └── security/
├── database/migrations/001_initial_schema.sql
├── templates/SALES_SUP_ASM_IMPORT_TEMPLATES.xlsx
├── docs/MVP_SPEC.md
├── tests/fixtures/ (valid, duplicate, overlap, returns, invalid)
├── .github/workflows/ (typecheck, rust test, windows build)
└── README.md
```

## 9. Storage / backup / offline installation

- DB at OS app-data path under Windows user profile; no write to `Program Files`, working directory, or source repo.
- WAL mode; DB never copied by naive file-copy while writes are active. Backup with SQLite online backup API or `VACUUM INTO` performed consistently; verify manifest/hash.
- Backup is an explicit user action, recommend daily on close or after successful imports, plus retention 7 daily/4 weekly by policy (off by default until destination configured).
- Backup sensitive data must be protected with Windows volume encryption/secure backup media. **Plain SQLite is not encrypted by itself.** If encryption at rest beyond BitLocker is mandatory, gate a tested SQLCipher/OS key management design before shipping.
- Signed Windows installer `.msi` or `.exe`. For air-gapped installation include WebView2 offline runtime in installer if required; not all target PCs can download bootstrapper. No auto-update dependence on network in P0.
- Export report must include filters, report period, data currency, generated_at and source batch metadata in `Thông tin báo cáo` sheet; do not insert hidden formulas/macros in imported files.

## 10. Quality gates / acceptance tests

| ID | Scenario | Expected |
|---|---|---|
| A01 | Empty DB / first-run | Setup displays; no fabricated KPI; import entry point available |
| A02 | Import valid SALES_IN file 100 rows | Exactly 100 active fact rows; totals equal source signed sum |
| A03 | Import same file hash twice | Warn/deny duplicate, totals unchanged |
| A04 | Reimport same NPP/kind/exact period revised file | Old batch inactive, new active, totals changed exactly once, audit preserved |
| A05 | Import overlapping but non-equal period for same kind/NPP | Reject with range conflict and visible source batch |
| A06 | XNT row 100 + 50 - 20 + 0 = 130 | Variance 0, accepted |
| A07 | XNT closing 131, other numbers unchanged | ERROR delta -1, no commit (unless explicit future override policy) |
| A08 | Missing SKU mapping | Error identifies row and raw SKU, no commit |
| A09 | SKU code `00123` | Preserved as string, not remapped to `123` |
| A10 | Sales Out return -3 / -30,000 | Actual reduced by 3 / 30,000 |
| A11 | Target NPP plus rep detail loaded | NPP KPI uses NPP-level target, not sum NPP + reps |
| A12 | DOH with no eligible issue history | Displays N/A, not 0 or Infinity |
| A13 | Stale XNT / absent Sales Out NPP | Dashboard shows freshness/partial instead of green valid KPI |
| A14 | Close app / reopen without network | All previously committed data visible and reports functional |
| A15 | Invalid/cancelled import at commit boundary | Transaction rollback; active historic data unchanged |
| A16 | 100k-row test workbook | UI remains responsive; errors/paging/memory benchmark recorded |
| A17 | Backup, restore in fresh Windows profile | SHA/integrity valid; views and KPI deterministic |
| A18 | App capabilities audit | Cannot execute arbitrary SQL or arbitrary read path from webview |

## 11. Implementation iterations and gates

**Sprint 0 — Foundation.** Create independent GitHub repo, initialize Tauri/Vite/React/Fluent UI, SQLite path/migration runner, local profile + main shell, CI static and test. Gate: signed dev build installed on test Windows and offline app opens.

**Sprint 1 — Master data.** NPP/territory/SKU/employee mappings + assignment period; import NPP/SKU/employee; display tables; test code normalization (leading zeros). Gate: master imported twice safely, no silent duplicate.

**Sprint 2 — Import engine.** File picker, parser, mapping templates, staged preview/validation, per-batch commit/revision and import_issues; source lineage and audit. Gate: A02–A09/A15 green.

**Sprint 3 — Facts & reports.** Sales In/Out, XNT, KPI/targets, dashboard/data states, Excel export. Gate: all totals reconciled against fixture Excel and period/date handling.

**Sprint 4 — Hardening.** Performance 100k rows, backup/restore, log sanitization, installer offline WebView2, UX polish, regression and Windows QA. Gate: A01–A18 pass, release v1.0.

### Definition of done
- No KPI without source and business definition.
- All import mutations atomic, versioned and auditable.
- No cross-period XNT snapshot double counting.
- Offline reporting works after restart.
- All hard errors actionable (sheet, row, column, reason).
- No security-sensitive filesystem/database API exposed to the untrusted webview.
- Install + restore documented and tested on clean Windows machine.

## 12. Risks requiring deliberate decisions

1. **Actual file sample:** mapping alias/unit, ledger basis, invoice status can only be finalized by auditing 1–2 real files per data family.
2. **Freshness:** NPP report cadence may differ (daily SO vs monthly XNT). UI must show data-as-of.
3. **Stock inclusion:** saleable vs blocked/quarantine/cận date; MVP period inventory is aggregate unless templates add separate columns in a later migration.
4. **Shared machines:** offline roles do not give server-grade access segregation; Windows profile isolation needed.
5. **Large files:** memory/time benchmark required before claiming performance.
6. **Changing business rules:** KPI engine version and transformation lineage should be added if formulas are revised; avoid rewriting historic facts silently.

## 13. Next engineering task

**Lưu ý lịch trình cũ:** phần Sprint 0/1 phía trên là baseline trước Master Plan PR #1. Không trực tiếp tạo Issue từ mục này. Quy trình hiện hành: M0 contract approval → tạo các Issue M1.1–M1.4 sau owner gate → M2 master/import → M3 reports, theo `docs/IMPLEMENTATION_PLAN.md` và `docs/M0_CONTRACTS.md`.
