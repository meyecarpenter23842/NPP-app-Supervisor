# Quy tắc ngôn ngữ giao diện — Supervisor (bắt buộc)

**Áp dụng:** toàn bộ ứng dụng Windows, 10 tab và màn hình con; tiêu đề, menu, nút, biểu mẫu, bảng, trạng thái, thông báo lỗi, hướng dẫn, Cài đặt; mọi tính năng hiện tại và tương lai.  
**Người đọc chính:** SALES, SUP, ASM trong ngành hàng tiêu dùng nhanh (FMCG).  
**Đã audit source:** `main@8f5eb65`, ngày 2026-10-10. Vấn đề điển hình: `Ánh xạ`, `Import`, `profile`, `batch`, `engine`, `SQLite`, `Tử số/Mẫu số`, tên mốc `M2/M3/M4` trên UI.  
**Phạm vi:** từ ngữ hiển thị, **không** thay tên schema, mã IPC, enum Rust/TypeScript, migration, dữ liệu gốc hoặc hợp đồng nhập liệu.

## 1. Nguyên tắc bắt buộc

1. **Nói việc cần làm và kết quả nhận được**, không nói về cách phần mềm được viết. Ví dụ: "Chọn cột dữ liệu Excel", không phải "Ánh xạ cột".
2. Tên chức năng dùng **động từ + đối tượng** khi cần thao tác ("Đối chiếu mã hàng NPP", "Lưu phân công"). Tên bảng/tab dùng danh từ quen thuộc ("Nhà phân phối", "Nhân viên", "Sản phẩm").
3. Ưu tiên **tiếng Việt ngành bán hàng**, tránh dịch từng chữ từ kỹ thuật. Không dùng "alias", "mapping", "batch", "profile", "engine", "schema", "backend", "SQLite", "runtime", "migration", "deploy" trong chữ hiển thị.
4. Các từ quen thuộc **NPP, NVKD, SALES, SUP, ASM, SKU, Sales In, Sales Out, KPI** được giữ nếu đúng ngữ cảnh; với vị trí lần đầu hoặc khó hiểu cần mô tả bằng tiếng Việt. "SKU" là **mã hàng/quy cách bán**, không đồng nhất với "sản phẩm" nhóm.
5. Giữ đúng **ngữ nghĩa nghiệp vụ**: mã trong tệp của NPP khác mã dùng chung; chỉ gắn doanh số vào nhân viên khi đủ căn cứ; lịch sử phân công theo ngày bán; chỉ đổi chữ **không đổi hợp đồng dữ liệu**.
6. Ngày hiệu lực diễn đạt "Áp dụng từ ngày / Áp dụng đến hết ngày" vì ngày cuối là **bao gồm**; tránh "đóng hiệu lực" và câu mơ hồ "ngừng từ ngày".
7. Khi quy đổi, giải thích bằng **đơn vị và ví dụ**: "1 thùng = 24 lon", nhập 24 đơn vị cơ sở cho 1 đơn vị trong tệp NPP. Không chỉ hiển thị "tử số/mẫu số", không tự đoán quy cách.
8. Lỗi nêu **vấn đề + hướng xử lý**, không lộ đường dẫn DB, SQL, mã lỗi hay nội dung nội bộ. Thành công chỉ thông báo **sau** khi dữ liệu thực sự được lưu.
9. Chức năng chưa có phải ghi "Chưa hỗ trợ" và điều kiện để sử dụng; không hiển thị mốc sprint (M2/M3/M4), tên module kỹ thuật hay gợi ý đã làm xong.
10. Không viết quá dài trên card hoặc nút. Cột bảng đủ ngữ nghĩa, không viết tắt khó đoán, ngày/tháng và VND nhất quán. Kiểm tra ở Windows 1366×768 và 1920×1080, keyboard/focus và giao diện hẹp; không nói đã QA nếu chưa chạy.

## 2. Bảng thuật ngữ chuẩn

| Ngữ cảnh | Không dùng trên UI | Dùng trên UI |
| --- | --- | --- |
| Menu | Dữ liệu & Import | Nhập dữ liệu |
| Chọn cột từ Excel | Ánh xạ cột / mapping | Chọn cột Excel |
| So sánh mã hàng NPP với mã chung | Ánh xạ SKU / alias | Đối chiếu mã hàng NPP; Mã hàng NPP đang dùng |
| So sánh mã nhân viên | Employee alias | Đối chiếu mã nhân viên NPP |
| Danh sách file đã xử lý | Lô nhập / batch | Lần nhập dữ liệu / Lịch sử nhập dữ liệu |
| Tài liệu định dạng | Profile ánh xạ | Mẫu chọn cột đã lưu |
| Chưa tìm ra nhân viên | Chưa gán | Chưa xác định nhân viên |
| Danh mục sản phẩm | Sản phẩm cha / family | Sản phẩm (nhóm mặt hàng); SKU (quy cách/mã hàng cụ thể) |
| Mã sử dụng xuyên NPP | Mã chuẩn | Mã dùng chung, hoặc Mã sản phẩm/Mã SKU/Mã nhân viên phù hợp từng biểu mẫu |
| Quy đổi | Tử số/Mẫu số | Số đơn vị cơ sở / Số đơn vị đang quy đổi; ví dụ 1 thùng = 24 lon |
| Bắt đầu/kết thúc quan hệ | Hiệu lực từ/đóng hiệu lực | Áp dụng từ ngày / Áp dụng đến hết ngày |
| Nguồn dữ liệu chưa có | Engine import chưa chạy | Chưa thể nhập tệp Excel trong phiên bản này |
| Thông tin ứng dụng | SQLite, DB, Backup, License, R2, tên M2/M3/M4 | Dữ liệu trên máy, Sao lưu, Giấy phép, Cập nhật; chỉ ghi chức năng hiện có |
| Trạng thái nguồn | MISSING/PARTIAL/STALE/CONFLICT | Chưa có dữ liệu / Thiếu dữ liệu / Dữ liệu đã cũ / Dữ liệu không khớp |
| Kết quả kiểm tra dữ liệu | Đối soát (không giải thích) | Kiểm tra chênh lệch, Đối chiếu kết quả, tùy ngữ cảnh |

**Ngoại lệ:** thuật ngữ kỹ thuật trong code, tài liệu developer, log nội bộ, tên bảng/API/enum, tệp nguồn Excel thực tế (không sửa tên cột gốc), cùng nhãn thương mại/chứng từ cần giữ nguyên theo nguồn.

## 3. Audit theo 10 tab (trước thay đổi)

| Tab | Vấn đề được tìm thấy | Hướng chuẩn hóa |
| --- | --- | --- |
| Tổng quan | engine, batch, MISSING/PARTIAL/STALE/CONFLICT | Câu người dùng hiểu, 4 trạng thái nguồn bằng tiếng Việt |
| Dữ liệu & Import | import, ánh xạ cột, profile ánh xạ, batch, lô nhập, sheet | Nhập dữ liệu, chọn cột Excel, lần nhập, trang tính |
| Sales In | PO, nguồn chứng từ, mã SKU viết tắt | Giữ Sales In/SKU; giải thích hóa đơn/chứng từ rõ ràng |
| Sales Out | Chưa gán, mã nhân viên nguồn, phân bổ | Chưa xác định nhân viên, mã nhân viên trên file NPP |
| Xuất nhập tồn | ĐVT, đối chiếu tồn | Đơn vị tính, kiểm tra chênh lệch tồn |
| Nhà phân phối | danh mục cục bộ, tuyến NPP | NPP/tuyến bán hàng rõ ràng, lưu trên máy |
| Đội ngũ kinh doanh | phân cấp hiệu lực, ánh xạ mã nhân viên | Quản lý trực tiếp, phân công theo ngày |
| Chỉ tiêu & KPI | từ KPI khi thiếu ngữ cảnh | Chỉ tiêu, kết quả thực hiện, tỷ lệ đạt |
| Phân tích SKU | Sản phẩm cha, ánh xạ SKU, tử số/mẫu số | Sản phẩm, SKU, mã NPP, quy đổi có ví dụ |
| Báo cáo | batch, định dạng nội bộ, mốc M3 | Lần nhập dữ liệu, điều kiện xuất báo cáo |

Ngoài 10 tab, **Cài đặt/khởi động/lỗi IPC** phải dùng tiếng Việt dễ hiểu, không lộ nội bộ.

## 4. Gate bắt buộc cho PR về UI

- Review **toàn bộ chữ mà người dùng có thể nhìn thấy**: điều hướng, tên màn hình con, tooltip/hint, nút, placeholder, bảng, modal, trạng thái trống/đang tải/thành công/lỗi, Cài đặt.
- Review người dùng thực tế: ASM phải biết "đây là gì, phải nhập gì, chuyện gì xảy ra khi bấm"; **không cần biết SQL hoặc kiến trúc**.
- Static regression test chặn từ cấm phổ biến trong các màn hình chính; những chỗ exception phải có lý do. Không chặn từ trong identifier/enum/code.
- Chạy lint, typecheck, test, build, CI theo quy định. QA nội dung dài/Windows native riêng, ghi rõ CHƯA XÁC MINH nếu chưa thực hiện.
- GitHub: branch riêng, PR, CI xanh, owner duyệt merge. **Đổi chữ không được tự đổi dữ liệu/schema, 10 tab, tên IPC hay business logic.**

## 5. Ví dụ chuẩn cho việc triển khai M2.2

- **Bước 1: Chọn tệp Excel của NPP** → **Bước 2: Chọn cột trong tệp tương ứng với dữ liệu cần nhập** → **Bước 3: Xem trước và kiểm tra dòng lỗi** → **Bước 4: Xác nhận nhập dữ liệu**.
- Mã SKU nguồn chưa khớp: "Mã hàng [mã] của NPP [tên] chưa được xác định. Hãy chọn mã hàng dùng chung trước khi nhập." Không gán đại.
- Khi đang xử lý: "Đang kiểm tra tệp…" Khi xong: "Đã kiểm tra 120 dòng; 8 dòng cần xử lý." (đây là **ví dụ hướng dẫn**, không phải dữ liệu thực trong app).
