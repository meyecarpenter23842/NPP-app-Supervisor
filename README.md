# Sales SUP/ASM Desktop — MVP Architecture Kit

Bộ tài liệu bàn giao để **bắt đầu lập trình** ứng dụng Desktop FMCG quản lý Sales SUP/ASM. Đây **chưa phải ứng dụng chạy được** và **chưa thay đổi repo NPP-Platform**.

## Files

- `docs/MVP_SPEC.md`: đặc tả MVP, nghiệp vụ, KPI, Import Center, UI, acceptance, security, lộ trình.
- `database/001_initial_schema.sql`: schema SQLite khởi tạo đã kiểm tra bằng SQLite in-memory.
- `database/002_report_query_examples.sql`: ví dụ SQL báo cáo, có scope, placeholder và nguồn truy vết.
- `templates/SALES_SUP_ASM_IMPORT_TEMPLATES.xlsx`: 8 worksheet hướng dẫn, master, SI/SO, XNT, Target, số liệu mẫu.
- `packages/contracts/index.ts`: DTO TypeScript cho IPC, trạng thái nguồn và import.
- `tests/smoke_sqlite.py`: smoke test schema/variance/import replacement.

## Start

1. Đọc `docs/MVP_SPEC.md`, nhất là mục định nghĩa Sales In/Out/XNT, trước khi code.
2. Chạy `python tests/smoke_sqlite.py`.
3. Khởi tạo repo Tauri 2 + Vite + React/TS; dùng database SQL này trong migration manager (PRAGMAs riêng ở initialization).
4. Xây Master data import trước, sau đó Sales In/Out/XNT.
5. Chỉ đánh dấu dữ liệu ACTIVE sau khi import được validate và transaction commit hoàn tất.

**Cảnh báo:** Bảng KPI và file Excel chứa dữ liệu minh họa, không được sử dụng làm số liệu thật. Không tin file Excel có macro/formula, external links hoặc đường dẫn bất kỳ.
