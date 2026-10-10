# M2.1 — Đề xuất thiết kế Master Data đa NPP (chờ owner duyệt)

**Ngày:** 2026-10-10  
**Trạng thái:** DRAFT / CHƯA CHỐT — chưa cho phép tạo Issue code, sửa migration hoặc triển khai.  
**Nguồn:** [MASTER_PLAN.md](../MASTER_PLAN.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [NPP_PLATFORM_REFERENCE.md](NPP_PLATFORM_REFERENCE.md), SQLite `database/001_initial_schema.sql` + migration `002_local_operator.sql`.

## 1. Mục tiêu và ranh giới

Một ứng dụng desktop Tauri/Rust + SQLite, **một Local Operator** (SALES/SUP/ASM), quản lý danh mục và phân cấp để tổng hợp số liệu **nhiều NPP** qua nguồn Excel/CSV. Không thực hiện ERP vận hành NPP, tạo user cấp dưới, giao dịch mua/bán, cloud DB hoặc các workflow RBAC/đặt hàng của NPP-Platform. Tất cả quyết định mapping phải có căn cứ và audit.

**M2.1:** NPP/vùng/tuyến, danh mục Sản phẩm–SKU/đơn vị/alias, nhân viên/phân cấp và phân công có hiệu lực, CRUD thực chất qua Tauri IPC + SQLite, validation/audit và test migration.  
**M2.2:** Đọc Excel/CSV, chọn sheet/map cột, preview, validation, lưu mapping.  
**M2.3:** Staging/commit nguyên tử, batch revision/supersession, reconciliation.

## 2. Đối chiếu schema đang có

- `distributors`, `territories`, `routes`, `employees`, `employee_distributor_assignments` đã có baseline.
- `products(id, sku_code, name, category, base_unit, active)` **đang đại diện cho từng SKU**, không có sản phẩm cha.
- `sku_aliases(distributor_id,raw_sku_code,product_id,raw_unit,conversion_num,conversion_den,effective_from,effective_to)` hiện ánh xạ trực tiếp NPP → một SKU chuẩn, theo thời gian.
- Các fact Sales In/Out/XNT đã tham chiếu `products.id`; đây là khóa ổn định, **không được đổi ngầm hoặc làm mất dữ liệu**.
- `employees.code` có UNIQUE toàn cục; thiếu mã NVKD nguồn theo từng NPP và bảng lịch sử quản lý; migration `002_local_operator.sql` đã sửa operator singleton và chuyển role nhân viên REP → SALES. Kiểm tra dữ liệu runtime hiện hữu trước khi thiết kế `003` cuối cùng.

## 3. Sản phẩm → nhiều SKU: mô hình nghiệp vụ

Ví dụ minh họa (chưa phải dữ liệu nguồn):

| Cấp | Mã | Ý nghĩa |
| --- | --- | --- |
| Sản phẩm cha | SP-COCA | Coca-Cola |
| SKU A | COCA-330-LON | Coca-Cola 330 ml — lon |
| SKU B | COCA-500-CHAI | Coca-Cola 500 ml — chai |
| SKU C | COCA-330-THUNG24 | Coca-Cola 330 ml — thùng 24 lon, **chỉ nếu** được quản lý như SKU kinh doanh độc lập |
| Alias NPP X | CC330 | NPP X gọi SKU A bằng mã CC330 |
| Alias NPP Y | NUOCNGOT-01 | NPP Y gọi SKU A bằng mã khác |

**Đề xuất ít rủi ro cho SQLite:** thêm bảng sản phẩm cha `product_families(id, code UNIQUE, name, category, brand?, active, ...)`; giữ bảng `products` hiện có làm **SKU chuẩn** để bảo toàn FK từ fact và `sku_aliases`; thêm `products.product_family_id` FK tới cha. UI dùng nhãn dễ hiểu **Sản phẩm** và **SKU** dù tên bảng cũ `products` vẫn là lớp SKU. Không bê nguyên tên schema PostgreSQL `products/product_variants` của NPP-Platform.

- Mỗi SKU thuộc tối đa một sản phẩm cha tại một thời điểm. SKU mới yêu cầu liên kết sản phẩm cha; SKU dữ liệu cũ có thể tạm là **“Chưa phân nhóm”** chờ xác nhận, không tự ghép theo tên/mã.
- Mã sản phẩm cha và mã SKU chuẩn ổn định. Ngừng kinh doanh = đổi trạng thái, **không xóa cứng** SKU đã có giao dịch.
- SKU độc lập khác biệt quy cách/thương phẩm có mã riêng; **chỉ khác đơn vị nhập** (thùng/lon) mà cùng mặt hàng tồn kho có thể biểu diễn bằng đơn vị và quy đổi, không tạo SKU thứ hai nếu không có identity nguồn riêng.
- Mỗi SKU có đơn vị cơ sở rõ ràng. Đơn vị/phép quy đổi phải xác nhận theo mặt hàng và nguồn; dùng tỷ lệ phân số nguyên dương hoặc fixed-point chính xác, tuyệt đối không lấy khối lượng/thể tích vật lý để tự đoán số lon/thùng.
- Gộp doanh thu theo sản phẩm cha có thể dùng VND; **không cộng số lượng khác đơn vị** (lon/chai/lít/thùng) nếu chưa chuẩn hóa về một thước đo có nghĩa.
- `sku_aliases` tiếp tục giữ **mã hàng và đơn vị xuất hiện trong file theo NPP** cùng thời gian hiệu lực; `product_id` hiện tại vẫn tham chiếu SKU `products.id`. Khác nhau giữa "SKU chuẩn" và "mã NPP" phải rõ.
- `raw_sku_code` và mọi mã có số 0 đầu luôn là TEXT. Một (NPP, raw_sku_code, raw_unit, business_date) chỉ ánh xạ tối đa **một** SKU; cấm chồng lấn khoảng hiệu lực xung đột, nhưng cho cùng raw code ở NPP khác nhau.
- Phân biệt quy đổi nguồn NPP → **đơn vị cơ sở của SKU** với quy đổi giữa các SKU bán lẻ/thùng của cùng sản phẩm; không nhân quy đổi hai lần. Quy tắc cuối cho variant/UOM tùy thuộc file thực tế.

## 4. NPP, nhân sự, phân cấp

**NPP/tuyến:** `distributors` có mã duy nhất, tên, vùng, active; `routes` thuộc chính xác một NPP; cùng mã tuyến ở các NPP khác nhau được phép. Không xóa NPP/tuyến đã xuất hiện trong lịch sử.

**Nhân viên:** ID chuẩn riêng, mã nội bộ, tên, loại SALES/SUP/ASM, trạng thái; nhân viên dưới quyền là business subjects, không có login. Bổ sung:

1. `employee_code_aliases(id, distributor_id, raw_employee_code, employee_id, effective_from, effective_to, ...)`: mã nguồn NVKD có namespace **theo NPP** và ngày. Một mã NPP tại một thời điểm không được gán đồng thời nhiều nhân viên.
2. `employee_hierarchy_assignments(id, employee_id, manager_employee_id, effective_from, effective_to, ...)`: quan hệ quản lý có ngày hiệu lực; không tự quản lý, không có vòng lặp, không có hai manager xung đột cùng kỳ. Validate cấp quản lý theo chính sách SALES/SUP/ASM được owner chốt.
3. Giữ `employee_distributor_assignments` có ngày hiệu lực; **một nhân viên có thể phụ trách nhiều NPP**. Cấm các bản ghi trùng/xung đột cùng (employee,NPP) trong cùng kỳ, không áp một-NPP-duy-nhất.
4. Phân công tuyến theo ngày (nếu dữ liệu có tuyến): bảng liên kết employee–route có `effective_from/to` và kiểm soát route thuộc NPP được phân công; không tự gán tuyến nếu file không có.

**Attribution:** Doanh số Sales Out gắn nhân viên bằng (NPP, raw employee code, business_date) hoặc quy tắc nguồn đã owner xác nhận. Drill-down SUP/ASM sử dụng **cây quản lý tại ngày của dòng giao dịch**, không dùng quan hệ hiện tại áp ngược về trước. Không tìm thấy hoặc mơ hồ → **“Chưa gán”**, vẫn giữ doanh số NPP và dấu vết nguồn, không suy đoán theo tên.

**Khoảng hiệu lực:** dùng `YYYY-MM-DD`, nhất quán inclusive `[from,to]`; `to = NULL` nghĩa là vô hạn. Validation reject `to < from`, overlapping identity conflicts, cycles tại các đoạn thời gian liên quan, tham chiếu chéo NPP/tuyến sai. Cần transactional protection bên Rust/SQLite; unique theo `effective_from` **không đủ** chống overlap.

## 5. Migration và hợp đồng phát triển M2.1

- Tạo **migration SQLite `003` forward-only** qua runner Rust đã có version/checksum; không chỉnh `001`/`002`, không drop/recreate fact tùy tiện.
- Ưu tiên additive `product_families` + `products.product_family_id NULL` + employee alias/history/route assignment; giữ nguyên `products.id` cùng mọi khóa ngoại fact và lịch sử đã nhập.
- DB cũ còn sản phẩm chưa gán cha thì đánh dấu **chưa phân nhóm**; không tự suy ra nhóm cha hoặc manager theo tên.
- Test fresh install + upgrade từ DB 001/002 có dữ liệu, integrity/FK, idempotency migration runner, backup trước nâng cấp, rollback khi lỗi, bảo toàn số hàng và khóa gốc.
- CRUD thực qua Rust Tauri commands; validation logic và transaction trên backend, typed contracts/frontend không mô phỏng thành công. Audit chỉnh sửa mã, nhóm, mapping, assignment. Thao tác sửa historical mapping phải có cảnh báo ảnh hưởng kỳ dữ liệu và không ghi đè nguồn.
- UI tại tab NPP / Nhân sự / SKU hỗ trợ list/search/filter, tạo/sửa/ẩn, liên kết, trạng thái trống/lỗi/đang xử lý; giữ 10 tab và Settings ngoài sidebar.

## 6. Tiêu chí nghiệm thu trước khi bắt đầu M2.2

- 1 sản phẩm cha có thể chứa nhiều SKU, mỗi SKU có mã riêng; NPP A/B có mã alias khác nhau nhưng cùng SKU chuẩn.
- 2 NPP dùng cùng mã SKU/mã SALES không bị ánh xạ nhầm; mã có số 0 đầu không mất.
- Không nhân đôi số lượng hoặc quy đổi nhiều lần; doanh thu rollup không bị nhân đôi; quantity khác đơn vị không cộng bừa.
- SALES đổi SUP/ASM theo ngày: báo cáo kỳ cũ giữ quan hệ đúng; cùng ngày không thể có hai manager xung đột; không tạo cycle.
- Sửa/xóa mềm có audit, không làm mất fact/lineage; dữ liệu chưa ánh xạ có trạng thái dễ nhận biết.
- Rust tests + SQLite upgrade/backup/FK checks + frontend lint/typecheck/test/build + Windows CI PASS cho PR **triển khai**, không xem UI mock là CRUD đã xong.

## 7. Những điểm cần owner chốt trước khi tạo Issue triển khai

1. **Chấp thuận mô hình Sản phẩm cha → nhiều SKU, với bảng `products` hiện hữu tiếp tục đại diện SKU để giữ FK?** Đây là đề xuất tương thích, không phải sao chép schema ERP.
2. **SKU thùng** có là mã bán hàng độc lập hay chỉ là đơn vị quy đổi? Quyết định theo thực tế mã hàng và file nguồn từng NPP; có thể hỗ trợ cả hai trường hợp với quy tắc rõ.
3. Cấp quản lý: SALES nhất thiết qua SUP hay cho phép thuộc ASM trực tiếp khi chưa có SUP? Có lịch sử đổi vai trò cần theo ngày không?
4. Cần **file Excel/CSV thật đã ẩn dữ liệu nhạy cảm**: danh mục NPP, sản phẩm/quy cách, nhân viên/mã nguồn, Sales Out mẫu; xác nhận tên sheet/cột, ngày nghiệp vụ, mã, đơn vị, quy cách, mã nhân viên, trường hợp mã trùng trước khi khóa mapping và tiến sang M2.2/M3.

**Gate:** Sau khi owner duyệt mô hình và chỉ rõ các điểm cần xử lý từ file mẫu, mới cập nhật Master Plan nếu cần, tạo Issue(s) M2.1, branch triển khai, test → PR → CI xanh → owner duyệt merge. Tài liệu này chưa cấp phép code.
