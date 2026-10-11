# M2 — Sửa chọn cột Excel và hợp đồng các nhóm dữ liệu

**Quyết định owner:** 11/10/2026, sửa theo bàn giao import Excel.  
**Base đã audit:** `main@7137d6734497586039fdd4d4e8b7c12778a8e083` (PR #25).  
**Issue thực hiện:** #26.  
**Gate:** PR/CI xanh và owner duyệt merge riêng; chưa có Windows visual QA từ máy thật.

## Điều đã thống nhất

- Mỗi nhóm dữ liệu có bộ trường chuẩn của app, người dùng không tạo trường mới khi nhập.
- NPP/kỳ/loại dữ liệu là metadata ở ngoài Excel khi loại file cho phép. Không bắt buộc cột NPP phải có trong tệp của chỉ một NPP.
- Bảng hiển thị *toàn bộ cột nguồn* có dropdown trường chuẩn ngay phía trên cột, tên header gốc và dữ liệu mẫu ngay dưới, cuộn ngang được.
- Một trường chuẩn chỉ nhận một cột nguồn. Những cột “Không sử dụng” hoàn toàn không ảnh hưởng phép tính. Tự gợi ý chỉ với tên cột rõ ràng; nguồn mơ hồ người dùng xác nhận.
- Ánh xạ cột theo vị trí, không theo tên header có thể trùng; đồng thời giữ tương thích hợp đồng request cũ theo header text.
- Mẫu lưu theo (loại dữ liệu, NPP, chữ ký cấu trúc header), không theo file hash hay tên file, để tái dùng sau khi mở lại app. Cho phép ghi lại mẫu sau khi sửa.
- Backend phải validate lại; frontend chỉ hiển thị, không nắm quyền quyết định nghiệp vụ.
- Đối chiếu mã nguồn SKU/nhân viên theo NPP, hiệu lực ngày; không suy diễn tên hoặc nhân sự theo cây quản lý hiện tại.
- Giữ transaction/revision/duplicate/history và signed returns, không sửa production/local.

## Giới hạn code của Issue #26 (không mở rộng khi thiếu contract)

**Đã có backend ghi nhận:** SALES_IN/SALES_OUT. Fix UI/ánh xạ/khôi phục mẫu cho 2 loại này và bật mapping optional route/outlet đã có cột trong sales_out_facts; kiểm tra thuộc NPP/tuyến trước ghi.

**Chưa có backend nhập Excel chính thức:** NPP, SKU, EMPLOYEE, XNT, TARGET, OUTLET. Không tạo mục nhập “đã hỗ trợ” giả; 6 loại này cần từng contract trường và validation riêng, đặc biệt SKU product family/UOM, nhân viên quản lý theo ngày, snapshot XNT và mức giao chỉ tiêu. Hai loại bán hàng tiếp tục là hai dữ liệu đầu tiên có thể chọn.

## Baseline trường chuẩn cần đối chiếu tiếp với dữ liệu mẫu thực

| Loại | Baseline tài liệu | Trạng thái |
| --- | --- | --- |
| NPP | 4 (mã, tên, khu vực, trạng thái) | chờ xác minh nhập hàng loạt |
| SKU | 4 trong MVP_SPEC cũ; mô hình M2.1 đã có product families + SKU + aliases/conversions | chưa khóa danh sách nhập |
| EMPLOYEE | 6 trong MVP_SPEC cũ; M2.1 bổ sung alias/hierarchy | chưa khóa danh sách nhập |
| SALES_IN | 9 trong MVP_SPEC cũ, NPP/kỳ chọn ngoài file | **bộ bắt buộc thực tế hiện tại giữ: date, document, sku, unit, quantity, amount**; line/type tùy chọn |
| SALES_OUT | 12 trong MVP_SPEC cũ, NPP/kỳ chọn ngoài file | **bắt buộc như SALES_IN**, thêm employee/outlet/route tùy chọn với mapping đúng NPP |
| XNT | 10 trong MVP_SPEC cũ | chờ quy tắc snapshot và chi tiết kỳ |
| TARGET | 6 trong MVP_SPEC cũ | mã nhân viên bắt buộc nếu cấp giao nhân viên |
| OUTLET | chưa có trong MVP_SPEC cũ | chờ contract điểm bán/tuyến |

Mẫu chính thức chỉ được chốt khi kiểm tra file thực tế; không dùng tổng số cột để ép mọi tệp phải có đủ. Số chứng từ vẫn bắt buộc ở backend Sales In/Out hiện hành, chưa chuyển sang dataset tổng hợp vì chưa thống nhất khóa dòng/loại granularity.

## Acceptance/CI

1. 2 NPP header khác nhau nhưng cùng canonical field; không trùng trường, thiếu bắt buộc có thông báo.
2. Giữ zero-prefix, scoped alias, UOM conversion; return âm, cancelled bỏ qua.
3. File chỉ có SKU và đơn giá bị nhận diện là bảng giá, không được ghi doanh thu.
4. Lưu profile SQLite, nạp lại theo bộ header giống nhau sau app restart, hỗ trợ sửa và thay mẫu.
5. Khi mapping route/outlet: mã thuộc NPP, outlet thuộc route đã chọn; mã không hợp lệ báo lỗi.
6. Import lại file hash cũ không cộng dồn; thay kỳ giữ lineage, không mất source.
7. React typecheck/test/build, Rust fmt/check/test, installer workflow CI. Windows native 1366×768/1920×1080 và dropdown overflow phải được QA trước merge.

**Không có file Excel thực tế trong GitHub**, các quy tắc nhận dạng hiện tại chỉ là gợi ý bảo thủ; không kết luận mọi định dạng NPP đều chạy đúng trước kiểm tra dữ liệu thật.

## Issue #28 — Giá trị chung theo tệp và mở nút xem trước (2026-10-11)

Owner phản hồi sau PR #27: không phải tệp nào cũng có cột ngày, số chứng từ, đơn vị, số lượng, tiền cho từng dòng. UI cũ khóa “Xem trước” ngay khi thiếu cột, không thể xác nhận những thông tin có giá trị chung.

- Bên cạnh dropdown ngay trên từng cột Excel, mỗi canonical field được chọn **cột nguồn** hoặc **giá trị cố định cho mọi dòng của tệp**; hai nguồn không được đồng thời dùng cho một field.
- Field `date` có thể đặt ngày chung, `unit` dùng đơn vị chung, `document` khai báo mã chung hoặc mã truy vết nguồn `SRC:<hash>:<sheet>:<row>` được người dùng chọn rõ ràng. Mã SRC không phải số hóa đơn/NPP.
- `quantity` và `amount` có thể nhận hằng số chỉ khi toàn bộ dòng thực sự tương ứng; bảo vệ tối thiểu: bắt buộc **ít nhất một trong hai** lấy từ cột Excel thật, chặn việc tạo doanh số từ file không có dữ liệu giao dịch.
- Trường cố định được lưu và khôi phục theo mẫu NPP + loại dữ liệu + cấu trúc header; preview và commit cùng dùng một logic kiểm tra nguồn, không làm giả dữ liệu.
- Nút xem trước chỉ khóa khi chưa có file hoặc đang xử lý; các lỗi thiếu NPP, kỳ, trường, định dạng số/ngày được hiển thị rõ khi bấm.
- Cùng hash tệp nhưng mapping/giá trị chung thay đổi phải đi qua revision/supersede; không được coi là duplicate hoàn toàn giống.
- Không thay schema sản xuất hay thêm loại nhập master/XNT/KPI/OUTLET chưa hỗ trợ.

QA cần xác minh ở Windows với ví dụ tệp chỉ có `SKU,SL,Thành tiền`, ngày/đơn vị/mã dòng ở UI, và tệp có cột nguồn như trước. Không coi cấu hình cố định bằng chứng thật cho các giao dịch; người dùng phải xác nhận dữ liệu nguồn.
