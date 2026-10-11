# M2.2 — Thiết kế nhập dữ liệu Excel/CSV đa NPP (đề xuất chờ owner duyệt)

**Ngày lập:** 2026-10-11  
**Trạng thái:** DRAFT — chưa chốt mapping file thật, chưa tạo Issue hoặc code M2.2  
**Base đã kiểm tra:** `main@484eed61c50f34b337ec4915e0d64fb160fcc338` (PR #22 đã merge)  
**Tham chiếu:** [Master Plan](../MASTER_PLAN.md), [Implementation Plan](IMPLEMENTATION_PLAN.md), [M0 Contracts](M0_CONTRACTS.md), [M2.1 Design](M2_1_MASTER_DATA_DESIGN.md), [Quy tắc ngôn ngữ UI](UI_LANGUAGE_RULES.md), [NPP-Platform Reference](NPP_PLATFORM_REFERENCE.md).

## 1. Phạm vi nghiệp vụ và quyết định đã khóa

Supervisor là ứng dụng Windows chạy độc lập, **một người dùng SALES/SUP/ASM**, nhận tệp Excel/CSV của **nhiều nhà phân phối** để xem và phân tích, không phải ERP của chính NPP. Chỉ có một operator; SALES, SUP, ASM dưới quyền là dữ liệu nhân viên, không tạo tài khoản.

**M2.2 chỉ thực hiện đọc tệp → chọn trang tính → chọn NPP/loại dữ liệu/kỳ → chọn cột → xem trước → kiểm tra lỗi → lưu cách chọn cột.** Không xác nhận ghi doanh số/kho/chỉ tiêu chính thức, không thay bản nhập cũ; **M2.3** chịu trách nhiệm ghi nguyên tử, quản lý lần nhập mới/sửa, bỏ trùng và đối chiếu tổng.

Không yêu cầu server hoặc tài khoản NPP, không gửi tệp lên mạng/R2, không sửa dữ liệu chính thức khi người dùng đang xem trước. Excel thật (đã che thông tin nhạy cảm) là **gate trước khi khóa cách nhận diện cột, xử lý loại file và code M2.2**.

## 2. Luồng thao tác thấy được trong app (tiếng Việt cho ASM/SUP)

Mục chính vẫn là **Nhập dữ liệu**, gồm ba màn hình con đang có:

| Màn hình | Người dùng nhìn thấy và thao tác |
| --- | --- |
| Lần nhập dữ liệu | Chọn loại số liệu (NPP, sản phẩm, nhân viên, Sales In, Sales Out, tồn kho, chỉ tiêu), chọn NPP, kỳ báo cáo, tệp; xem các lần nhập trước và trạng thái rõ nghĩa |
| Chọn cột Excel | Chọn trang tính, dòng tiêu đề, chọn cột của tệp tương ứng với ngày/mã hàng/mã nhân viên/số lượng/doanh số; lưu cách chọn cột **riêng cho từng mẫu file** |
| Dòng cần kiểm tra | Danh sách trang tính, số dòng, cột, giá trị nhận được, lý do không hợp lệ và cách xử lý; nhóm mã hàng/mã nhân viên chưa xác định |

Luồng sau khi chọn tệp:

1. **Chọn tệp Excel/CSV** và NPP/loại số liệu/kỳ muốn kiểm tra.
2. **Chọn trang tính và cột dữ liệu**; hiển thị ngay vài dòng đầu; không tự chọn cột khi có nhiều đáp án.
3. **Xem trước kết quả:** tổng dòng, dòng hợp lệ, dòng cần sửa, mã hàng/mã nhân viên chưa xác định; có thể quay lại đổi cột.
4. **Lưu cách chọn cột** cho những lần nhập cùng mẫu đã được xác nhận (không ràng buộc với tên file tùy ý, version có hiệu lực).
5. **Kết quả kiểm tra:** tải danh sách lỗi để xử lý hoặc chuyển sang bước xác nhận nhập ở M2.3 (khi chức năng này được triển khai). Trong M2.2 tuyệt đối không hiển thị thông báo kiểu “Đã nhập doanh số” khi chưa ghi.

Mọi thông báo phải theo `UI_LANGUAGE_RULES.md`: **“Chọn cột Excel”**, **“Đối chiếu mã hàng NPP”**, **“Chưa xác định nhân viên”**, **“Lần nhập dữ liệu”**; không đưa lên UI các từ `mapping`, `batch`, `profile`, `parser`, `staging`, `engine`, `schema`, `SQLite`.

## 3. Cần xác minh từ file nguồn thật (chưa được khẳng định)

Tối thiểu cần **1–2 tệp mẫu của mỗi kiểu định dạng khác nhau** mà ASM nhận từ các NPP, ưu tiên file Sales Out của **hai NPP** có mã hàng/nhân viên khác nhau; thêm danh mục SKU, nhân viên, Sales In, tồn kho, chỉ tiêu nếu có. Chỉ yêu cầu mẫu đủ hàng và cột, che số điện thoại, địa chỉ khách, giá/dữ liệu nhạy cảm không cần thiết; không lưu file thật vào Git.

Ghi nhận bằng bảng kiểm:

- Tệp `.xlsx`/`.xls`/`.csv`, mã hóa CSV, nhiều trang tính, trang tính nào chứa số liệu, vị trí dòng tiêu đề, dòng tổng cộng/cuối file, tên cột thực tế.
- Cột xác định NPP (nếu tệp có nhiều NPP), mã NPP, kỳ và **ngày bán/ngày chứng từ**; phân biệt ngày Excel serial, chuỗi ngày, định dạng tháng/ngày.
- Mã SKU NPP, đơn vị bán (thùng/lon/chai), cách quy đổi, mã nhân viên NPP và chứng từ; **mã bắt đầu bằng 0 phải giữ đúng**.
- Giá trị tiền là VND, số lượng, số âm/trả hàng, trạng thái chứng từ, cách ghi nhận Sales In/Out, độ chính xác và quy tắc làm tròn.
- File dữ liệu tổng hợp/ngày/tháng hay từng dòng chứng từ; nhận diện giao hàng, trả hàng, bị hủy/chưa giao.
- Tình huống trùng mã giữa NPP, trùng số chứng từ, cùng một file nhập lại, nguồn chỉnh sửa/sửa kỳ, nguồn thiếu nhân viên hoặc SKU.

**Chưa xác minh:** bất kỳ cấu trúc file nguồn NPP thực tế nào. Chưa được phép kết luận cột X là ngày, cột Y là doanh số hoặc đặt quy tắc chuyển đổi cho mọi NPP.

## 4. Kiểu dữ liệu cần hỗ trợ và các trường cần đối chiếu

| Dữ liệu | Cần đối chiếu từ file trước khi duyệt cách nhập |
| --- | --- |
| Nhà phân phối | Mã NPP trong file, tên NPP; không ghép chỉ dựa trên tên |
| Sản phẩm/SKU | Mã NPP, tên sản phẩm, SKU/quy cách, đơn vị; liên hệ sản phẩm → SKU trong M2.1 |
| Nhân viên | Mã NVKD theo NPP, tên, phân cấp/quản lý theo ngày và phạm vi NPP; không tạo user |
| Sales In | Ngày chứng từ, số chứng từ, mã NPP, SKU, số lượng/giá trị, loại hóa đơn/trả |
| Sales Out | Ngày bán/giao, mã NVKD NPP, số chứng từ, mã SKU NPP, đơn vị, số lượng/giá trị, hủy/trả |
| Tồn kho | Kỳ, mã NPP/SKU, tồn đầu/nhập/xuất/điều chỉnh/tồn cuối và đơn vị |
| Chỉ tiêu | Tháng, cấp giao (NPP/SALES/SUP), mã đối tượng, loại chỉ tiêu, giá trị |

**Quy tắc bắt buộc:** cùng mã nhân viên/SKU ở hai NPP có thể khác đối tượng; xác định theo `(NPP, mã trong file, ngày nghiệp vụ)` và đơn vị (nếu là SKU). Nhân viên chưa xác định vẫn là **chưa xác định**, không suy đoán theo tên. Tỷ lệ quy đổi phải lấy cấu hình được chốt, không tự tính từ chữ “thùng”.

Danh sách trên là **checklist**, chưa phải schema cột bắt buộc cho mọi loại file. Khi có mẫu thật sẽ chốt trường bắt buộc/tùy chọn theo kiểu và NPP.

## 5. Đối chiếu mã nguồn hiện có — ranh giới kỹ thuật

**Đã kiểm tra trên `main@484eed6`:**
- `apps/desktop/src/components/BusinessContent.tsx` trang Nhập dữ liệu còn là placeholder “Chưa hỗ trợ”; chưa có chọn file/đọc trang tính/kiểm tra tệp.
- `apps/desktop/src-tauri/src/lib.rs` chưa đăng ký Tauri commands nhập tệp; chỉ có operator + master-data.
- `database/001_initial_schema.sql` đã có `import_profiles`, `import_batches`, `import_issues`, fact tables và view chỉ đọc các lần nhập đã được xác nhận.
- `import_batches` quy định **mỗi lần nhập một NPP + một loại dữ liệu + một kỳ chính xác**. Một file bao nhiều NPP sẽ cần tách thành các lần nhập theo NPP, chung file hash. Không trộn dữ liệu NPP khi kiểm tra.
- `import_profiles.kind` hiện có `SALES_IN, SALES_OUT, XNT, TARGET, NPP, SKU, EMPLOYEE, OUTLET`; **chưa có loại nhập riêng** cho tuyến hay lịch sử quản lý. Nếu tệp nguồn đòi hỏi thì đề xuất contract/migration sau khi xem file, không tự cho là đã hỗ trợ.
- Nguồn NPP-Platform `main@cdfc7c7`: tham khảo kiểm tra import SKU ổn định khi nhập lại (`npp-core/api/test/product-file-reimport-identity.test.js`), và hạn chế Excel/cột/trùng header (`npp-core/web/lib/tabular-workbook-xlsx.js`). Đây là ứng dụng ERP khác; **không sao chép** backend PostgreSQL, danh tính multi-user, hay module export vào Supervisor.

### Phân tách kiến trúc theo milestone

- **M2.2** — Rust/Tauri mở và đọc file an toàn; parser Excel/CSV; xem trước có giới hạn, chọn trang tính/header/cột; đọc mã chuỗi; kiểm tra cú pháp và thông tin NPP/SKU/NVKD theo M2.1, lỗi có nguồn rõ; lưu mẫu chọn cột có version; KHÔNG ghi fact.
- **M2.3** — lưu nguồn/lineage vào SQLite có transaction, kích hoạt phiên bản dữ liệu, ngăn trùng, thay lần nhập cũ an toàn, audit và truy xuất chênh lệch theo NPP/kỳ. Không gộp vào M2.2 vì dễ gây nhập trùng khi mới thử file.

Tệp nhập là dữ liệu không đáng tin: giới hạn dung lượng/số trang/dòng/cột theo thực tế rồi chốt, phát hiện file hỏng/ZIP bomb, không thực thi công thức/macro/đường dẫn bên ngoài, không truy cập mạng khi đọc Excel; tránh CSV formula injection nếu xuất danh sách lỗi. Không lưu nội dung file vào log/PR. Có khả năng hủy xem trước; lỗi đọc không làm mất master data hoặc dữ liệu đang lưu.

## 6. Cách kiểm tra trước khi triển khai M2.2 (khi đã duyệt)

- File có nhiều trang tính, chọn đúng cột và dòng tiêu đề; cột trùng/thiếu hiển thị rõ lý do.
- CSV UTF-8 BOM/dấu phân cách, Excel ngày số và ngày chuỗi; không đảo ngày/tháng, không mất số 0 đầu.
- 2 NPP có cùng mã SKU/NVKD nhưng khác đối tượng: **không đối chiếu sai**.
- Dòng bị hủy/trả/âm, mã nhân viên chưa tìm thấy, thiếu ngày/kỳ và sai đơn vị được phân loại đúng; không tính phần chưa xác định bằng 0.
- Dòng lỗi ghi **tên trang tính, số dòng Excel, cột, lý do**, cho người dùng sửa rồi xem lại; không làm hỏng file nguồn.
- Xem trước và lưu cách chọn cột không sinh doanh số chính thức; mở lại ứng dụng vẫn có mẫu chọn cột đã lưu.
- File nhập lại nguyên vẹn hoặc sửa kỳ: M2.2 phát hiện cảnh báo/trùng theo SHA256; việc thay dữ liệu thực là M2.3.
- Test dùng fixture tự tạo đã mô tả, không đẩy dữ liệu kinh doanh thật lên Git; Rust fmt/check/test, frontend lint/typecheck/test/build, Windows installer CI; nghiệm thu giao diện native 1366×768 và 1920×1080 tách riêng.

## 7. Gate cần owner phê duyệt trước khi tạo Issue/code

1. **Chốt phạm vi M2.2 là “Chọn tệp → Chọn cột → Xem trước → Kiểm tra → Lưu cách chọn cột”, chưa ghi doanh số/tồn/chỉ tiêu; việc ghi dữ liệu nằm ở M2.3.**
2. **Cung cấp file Excel/CSV thực tế đã che thông tin nhạy cảm**, ưu tiên Sales Out từ 2 NPP + danh mục SKU/NVKD và 1 ví dụ Sales In/XNT/KPI nếu nguồn có, hoặc mô tả chính xác nơi/file nguồn.
3. Xác nhận nguồn nào tổng hợp theo ngày/kỳ, nguồn nào theo chứng từ; các file có nhiều NPP và kỳ hay không; từ đó chốt version/ràng buộc trùng/giới hạn tệp.
4. Khi owner duyệt và nguồn thực được đối chiếu, cập nhật contract nếu cần, rồi mới tạo Issue M2.2, branch code, test → PR → CI PASS → owner duyệt merge.

**Chưa thực hiện:** không có bằng chứng mở/parse file NPP thật, không có schema migration/import parser/frontend import được viết trong PR tài liệu này.
