# Repo tham khảo nghiệp vụ — NPP-Platform

**Ngày ghi chú:** 2026-10-10  
**Repo nguồn:** https://github.com/binhnxwjfjxm/NPP-Platform.git  
**Main nguồn tại lần đọc:** `cdfc7c7e88f7112bb2b5d74c35e3dad79f6cf4e7`  
**Repo đích:** `meyecarpenter23842/NPP-app-Supervisor`  
**Trạng thái:** Tham khảo có kiểm tra mã nguồn; **không** phải đặc tả M2.1 đã được chốt.

## Vai trò hai phần mềm

- **NPP-Platform:** ERP phục vụ quy trình vận hành của nhà phân phối. Owner xác nhận đã xây dựng cấu trúc và sử dụng tương đối ổn; ghi nhận đây là **thông tin owner**, không phải kết quả smoke/production audit của Supervisor.
- **PM-QL-NPP-Supervisor:** Desktop Windows offline-first cho **một** local operator (SALES/SUP/ASM), đọc dữ liệu từ nhiều NPP để quản lý danh mục chung, nhân sự/phân cấp, Sales In/Out, XNT, chỉ tiêu, phân tích và báo cáo. Nhân viên cấp dưới chỉ là **đối tượng nghiệp vụ**, không có tài khoản đăng nhập.
- **Nguyên tắc:** Tham khảo cách mô hình hóa và các quy tắc nghiệp vụ đã triển khai ở NPP-Platform; điều chỉnh cho góc nhìn nhiều NPP, SQLite, Tauri/Rust và Excel/CSV-first. Không mặc định tính năng/luồng ERP phải có trong Supervisor.

## Những điểm đã kiểm tra trực tiếp trong NPP-Platform

| Chủ đề | Tệp nguồn cần xem | Bằng chứng và bài học |
| --- | --- | --- |
| Danh mục Sản phẩm → SKU | `database/migrations/shared/012_product_catalog_foundation.sql` | Có `shared.products` (sản phẩm cha), `shared.product_variants` (SKU con), `product_categories`, `product_brands`; mỗi SKU thuộc một sản phẩm, có biến thể BASE/CARTON/OTHER. |
| Đơn vị và quy đổi | `database/migrations/shared/013_product_units_conversions_barcodes.sql` | Có `units_of_measure`, `product_variants.unit_id`, `conversion_to_base`, `product_barcodes`; SKU bán/mua gắn với đơn vị và quy đổi về đơn vị cơ sở. |
| Quy tắc SKU | `docs/operations/product-catalog-foundation-slice.md`, `docs/operations/product-units-conversions-barcodes-slice.md` | Cấu trúc phân biệt sản phẩm và SKU, kiểm soát SKU trùng, quy đổi chính xác, chặn nhập chưa được giải quyết. Ghi chú trạng thái rollout trong các tài liệu này là lịch sử, không xác nhận trạng thái production hiện tại. |
| Lịch sử nhân sự | `database/migrations/shared/149_workforce_employee_history.sql` | Có mô hình khoảng hiệu lực và nhãn chất lượng dữ liệu lịch sử; hữu ích làm tham khảo, nhưng đây là lịch sử việc làm/chi nhánh ERP, **không tự thay thế** quan hệ SALES → SUP → ASM và phân công NPP/tuyến của Supervisor. |

Các đường dẫn trên tương ứng với source `main` được quan sát theo SHA ghi ở đầu tài liệu. Khi triển khai, audit lại HEAD và contract/code thực tế, không chỉ tin tài liệu cũ.

## Ứng dụng chọn lọc cho M2/M3

1. **M2.1 — Danh mục sản phẩm:** xem xét mô hình `Sản phẩm (mã chung) → nhiều SKU (mã biến thể/đóng gói)`; đơn vị chuẩn, tỷ lệ quy đổi, barcode nếu thực sự cần. Mã riêng của từng NPP là một **lớp alias/mapping nguồn** và có thể có hiệu lực theo thời gian, không đánh đồng với mã SKU chuẩn. Thiết kế cuối cùng chưa chốt khi chưa đối chiếu Excel thực tế và quyết định owner.
2. **M2.1 — Nhân sự:** tham khảo cách lưu khoảng hiệu lực, provenance và nhãn độ tin cậy; bổ sung nghiệp vụ riêng nhiều NPP/tuyến, manager-history theo `business_date` và ngăn gán nhầm khi mã SALES trùng giữa NPP.
3. **M2.2/M2.3 — Import:** chỉ tham khảo nguyên tắc kiểm tra mã, quan hệ, quy đổi và trace; Supervisor vẫn cần import Excel/CSV linh hoạt, preview, staging, atomic batch revision và đối soát.
4. **M3 — Số liệu:** tham khảo ngữ nghĩa chứng từ, nguồn dữ liệu và kiểm tra đối soát khi hữu ích, nhưng **Sales Out của Supervisor lấy từ file xuất NPP đã xác minh**, không tự sinh đơn hàng/quy trình bán hàng kiểu ERP.

## Ranh giới không được vượt qua

- Không thay Rust/Tauri/SQLite local bằng backend, PostgreSQL, web service hay mô hình đa user của NPP-Platform.
- Không kết nối trực tiếp hoặc chỉnh sửa database/production NPP-Platform; không biến NPP-Platform thành backend Supervisor.
- Không sao chép nguyên khối schema, API, UI hay nghiệp vụ ERP không liên quan (POS, quản lý đơn nội bộ, kho vận hành, HR/payroll, login/RBAC, v.v.).
- Không tự giả định cấu trúc Excel NPP giống dữ liệu nội bộ NPP-Platform. Ưu tiên file mẫu thực tế; nguồn thiếu/alias chưa khớp cần hiển thị rõ.
- Không coi bảng, migration hoặc tài liệu ở source là bằng chứng đã triển khai production. Trước bất kỳ Issue M2 nào, audit repo hiện tại, chốt phạm vi với owner, rồi mới code theo GitHub → CI → PR → owner duyệt merge.

**Ghi chú quyết định:** Owner yêu cầu chính thức đưa repo này vào danh sách tham khảo ngày 2026-10-10. Việc lựa chọn cấu trúc Sản phẩm/SKU cụ thể cho Supervisor còn nằm ở bước review thiết kế M2.1.
