# Thiết kế tổng thể — Workspace tập trung, nhập thủ công và Excel/CSV

**Ngày:** 2026-10-11
**Trạng thái:** DRAFT cho hợp đồng kỹ thuật/lộ trình; **owner đã duyệt nguyên tắc** thiết lập tập trung theo nghiệp vụ (Issue #19), bố cục Sản phẩm & SKU và yêu cầu **nhập thủ công + nhập Excel** toàn ứng dụng. Chưa duyệt migration/API/chi tiết thứ tự Issue code. Không phải bằng chứng triển khai.
**Mốc audit:** Supervisor main `3a1aa0b432d2fe1530925253aba00f7e5ac6e564`; NPP-Platform main `cdfc7c7e88f7112bb2b5d74c35e3dad79f6cf4e7`.
**Tài liệu nguồn:** [Master Plan](../MASTER_PLAN.md), [Implementation Plan](IMPLEMENTATION_PLAN.md), [M2.1](M2_1_MASTER_DATA_DESIGN.md), [M2.2](M2_2_IMPORT_DESIGN.md), [Column Mapping](M2_COLUMN_MAPPING_FIX.md), [NPP-Platform Reference](NPP_PLATFORM_REFERENCE.md), [Issue #19](https://github.com/meyecarpenter23842/NPP-app-Supervisor/issues/19).

## 1. Quyết định sản phẩm (đã thống nhất)

1. **Một nghiệp vụ = một khu vực thao tác đủ chức năng**. Trong đúng nơi đó có danh sách, thiết lập nhanh/tạo sửa, nhập Excel/CSV, đối chiếu, lịch sử liên quan. Không bắt chuyển qua tab nghiệp vụ khác để hoàn chỉnh một đối tượng. Dùng lại những component nền chung, không nhân bản luồng lưu dữ liệu.
2. **Hai phương thức nhập cùng nguồn sự thật**: thủ công từng bản ghi/chứng từ và hàng loạt Excel/CSV cùng đi qua validation/domain storage Rust và SQLite, cùng model canonical và báo cáo. Thủ công không phải bộ nhớ tạm ở frontend; Excel không có DB riêng.
3. **Giữ đúng 10 tab chính**, không thêm tab thứ 11. `Phân tích SKU` đổi nhãn thành **Sản phẩm & SKU** (giữ page id `sku` để tránh đổi contract kỹ thuật không cần thiết). Cài đặt ngoài sidebar.
4. **Sản phẩm & SKU là trung tâm danh mục hàng hóa**: sản phẩm cha, SKU/quy cách, đơn vị/quy đổi, mã vạch tùy chọn, mã và đơn vị NPP theo thời gian, bảng giá theo NPP/loại/ngày, nhập hàng loạt đều trong một workspace. **Không** thêm nút giá rời ở NPP, Sales In/Out hoặc Nhập dữ liệu để chỉnh danh mục.
5. Thống nhất tiếng Việt dễ hiểu với SALES/SUP/ASM; không hiển thị `alias`, `batch`, `mapping`, `schema`, `SQL` hay trạng thái giả cho người dùng.
6. Windows desktop offline-first Tauri/Rust/SQLite; **01 local operator** SALES/SUP/ASM, nhân viên chỉ là đối tượng kinh doanh; không ERP vận hành NPP, user cấp dưới, kho giao dịch, web backend hoặc cloud DB.
7. NPP-Platform là **nguồn tham khảo cách tổ chức luồng**, không sao chép PostgreSQL, API, mô hình bảng giá đa cấp/khuyến mãi phức tạp, quản lý tồn kho vận hành hoặc RBAC.

## 2. Cây điều hướng 10 tab — trách nhiệm rõ ràng

| Menu trái | Màn hình con/luồng đích | Viết tay | Excel/CSV | Nguồn dữ liệu |
| --- | --- | --- | --- | --- |
| 1. Tổng quan | Tình hình, cảnh báo, nguồn dữ liệu | Cấu hình hiển thị/bộ lọc có thật; không nhập KPI kết quả | Không ghi dữ liệu tại đây | Chỉ đọc dữ liệu đã xác nhận |
| 2. Nhập dữ liệu | Nhập Sales In/Out, lịch sử nhập chung, danh sách lỗi/nguồn | Xem, đối chiếu, xử lý vấn đề; chuyển đến khu vực nghiệp vụ để thêm tay | Trung tâm xem lịch sử & đường dẫn nhập; không tạo bộ danh mục thứ hai | Nguồn/phiên bản dùng chung |
| 3. Sales In | Tổng hợp, chứng từ, thêm/sửa ghi nhận bán vào, lịch sử | Ghi chứng từ thực có nguồn hợp lệ và hàng trả | Nhập Sales In từ Excel | Fact bán vào đã xác nhận |
| 4. Sales Out | Tổng hợp, chứng từ bán ra, theo NVKD, chưa gán, lịch sử | Ghi giao dịch thực, NVKD/NPP/SKU, trả hàng | Nhập Sales Out từ Excel | Fact bán ra đã xác nhận |
| 5. Xuất nhập tồn | Theo kỳ, ghi nhận số liệu kỳ, đối chiếu, lịch sử | Nhập **báo cáo/snapshot kho NPP** (tồn đầu, nhận, xuất, điều chỉnh, tồn cuối) | Nhập báo cáo XNT | Snapshot kỳ, không sinh phiếu kho ERP |
| 6. Nhà phân phối | Danh sách, **Thiết lập NPP**, tuyến/khu vực, Nhập Excel, lịch sử | Hồ sơ/tuyến/trạng thái/quan hệ thuộc NPP | Danh mục NPP/tuyến có kiểm tra | NPP và tuyến chuẩn |
| 7. Đội ngũ kinh doanh | Danh sách, **Thiết lập nhân sự**, sơ đồ, Nhập Excel, lịch sử | Nhân viên, vai trò, người quản lý theo ngày, phân công NPP/tuyến, mã NVKD theo NPP | Nhân sự/phân cấp/phân công có kiểm tra | Nhân sự chuẩn và lịch sử |
| 8. Chỉ tiêu & KPI | Thiết lập chỉ tiêu, thực hiện, so sánh, lịch sử | Tạo/sửa **chỉ tiêu được giao** theo tháng và cấp NPP/SALES/SUP | Nhập chỉ tiêu | Chỉ tiêu gốc; KPI thực hiện được tính |
| 9. **Sản phẩm & SKU** | **Thiết lập nhanh**, Danh sách SP, Mã NPP & bảng giá, Nhập Excel, Phân tích | Toàn bộ danh mục/quy đổi/mã NPP/giá trong một chỗ | Danh mục, mã NPP, bảng giá | Sản phẩm cha/SKU chuẩn/giá |
| 10. Báo cáo | Danh mục báo cáo, bộ lọc thực, xuất, lịch sử xuất | Chọn kỳ/NPP/chỉ số/mẫu báo cáo; không nhập doanh thu tổng tay | Xuất Excel hoặc đọc các lần nhập; không ghi fact tại báo cáo | Số liệu dẫn ngược được về nguồn |

**Không có hai bộ form ghi riêng:** trong từng workspace nghiệp vụ hiển thị `Thêm thủ công` và `Nhập Excel` gần nhau; dùng **một trình đọc/gán cột chung** cho các loại dữ liệu nhưng entry point theo nghiệp vụ. `Nhập dữ liệu` vẫn là trung tâm nghiệp vụ giao dịch và giám sát các lần nhập; nút nhập ở nơi nghiệp vụ điều hướng vào cùng engine với ngữ cảnh loại/NPP, không tạo bản triển khai duplicate.

## 3. Thiết lập nhanh Sản phẩm & SKU (bố cục owner đã duyệt)

Trong một workspace, trái là tìm/chọn sản phẩm (hoặc `Tạo sản phẩm`), phải là các phần thao tác liên tiếp, không dựng form lớn lặp lại trường:

1. **Sản phẩm chuẩn:** mã/tên sản phẩm, nhóm hàng, nhãn hàng, trạng thái. Dữ liệu dùng chung, không tạo lại theo NPP.
2. **SKU/quy cách:** một sản phẩm có nhiều SKU kinh doanh; mã/tên SKU, đơn vị cơ sở, trạng thái. SKU thùng chỉ là SKU khác khi nguồn có identity kinh doanh riêng; nếu chỉ là cách đếm thùng/lon thì thuộc đơn vị quy đổi.
3. **Đơn vị, quy đổi và mã vạch:** phép quy đổi chính xác về đơn vị chuẩn (tỷ lệ phân số/fixed precision); mã vạch tùy chọn; không tự đoán số lượng từ chữ `thùng`, không nhân quy đổi hai lần.
4. **Mã hàng theo NPP:** nhiều mã nguồn/đơn vị trên cùng SKU chuẩn; ràng buộc theo NPP, mã nguồn, đơn vị và thời gian hiệu lực; một mã+đơn vị trong một NPP tại một ngày chỉ trỏ một SKU.
5. **Bảng giá theo NPP:** danh sách giá có tên/mã, loại giá, NPP, SKU, đơn vị tính, VND, ngày bắt đầu/kết thúc, nguồn và trạng thái; hiển thị giá hiện hành và giá lịch sử; không sửa ngày cũ ngầm. Không triển khai engine khuyến mãi khách hàng đa tầng của ERP trong đợt này.
6. **Kiểm tra và lưu:** trạng thái thông tin đủ/chưa đủ, lỗi xung đột và kết quả lưu từ Rust; không cho UI thông báo thành công nếu transaction chưa thành công.

Các subview cùng khu vực: **Thiết lập nhanh | Danh sách sản phẩm | Mã NPP & bảng giá | Nhập Excel | Phân tích**. Danh sách/tìm kiếm và import hàng loạt liên thông với đối tượng đã chọn. Nhóm hàng, nhãn hàng, đơn vị cơ sở có thể tạo/chỉnh ở popover/section trong chính khu vực này; không bắt đi thiết lập ở menu trái khác.

Giữ nguyên `products.id` đang đại diện **SKU chuẩn**, `product_families` là cha và FK fact tham chiếu `products.id`; không đổi ID đã được import. SQLite hiện có các bảng `product_families`, `sku_unit_conversions`, `sku_aliases` và master CRUD. **Chưa có** schema giá theo NPP, import danh mục/bảng giá, hay auto tra tên/giá trong preview Sales. Danh mục nhóm/nhãn đơn giản ở schema hiện hữu cần audit contract và bổ sung thao tác đầy đủ, không nhận là đã có chức năng quản lý thành phẩm.

## 4. Nhập Excel/CSV danh mục và bảng giá ngay trong khu vực sản phẩm

- Chọn **loại** (sản phẩm/SKU chuẩn; mã NPP+quy đổi; bảng giá), NPP **khi loại yêu cầu**, file và sheet (chỉ hỏi sheet nếu nhiều sheet).
- Giữ nguyên UX đã duyệt của Sales Import: hiển thị tất cả cột nguồn; **một dropdown trường chuẩn trên đầu mỗi cột**, không gán một trường hai lần; cột không dùng để `Không sử dụng`. Thông tin cố định chung file chỉ nhập một lần ở dưới; không lặp lại trường đã gán cột.
- Sản phẩm/SKU chuẩn không ép NPP; giá và mã NPP luôn có NPP scope. Ghi nhớ cách chọn cột theo loại + NPP phù hợp + cấu trúc cột, không buộc tên file.
- Xem trước bản ghi với tên/mã/đơn vị/giá; phân loại **Thêm mới / Cập nhật / Không đổi / Cần xử lý**, chi tiết file-sheet-row-column, mã 0 đầu giữ text. Hiển thị số dòng theo đúng loại và kết quả sau commit; file khoảng **1.446 dòng giá** phải xử lý được mà không gõ lại từng giá (làm tiêu chí QA với fixture ảo, chưa xác minh file thật).
- Quy tắc nhận dạng ổn định theo khóa chuẩn và scope; nếu SKU chưa có cho phép đối chiếu hoặc nhập SKU chuẩn có xác nhận, không ghép mù theo tên. Bảng giá phải khóa theo mã bảng giá/NPP/SKU/đơn vị/ngày; giá xung đột hoặc không có quy tắc chọn phải hiện lỗi, không chọn tùy ý.
- Xem trước **không ghi**. Xác nhận ghi **transaction atomic, idempotent**, có kết quả và lịch sử nguồn, so sánh với phiên bản cũ; nhập lại không nhân đôi, thay giá không làm mất lịch sử, thiếu SKU trong file mới **không xóa tự động**. Khi lỗi chặn, không ghi một phần thầm lặng.
- `Bảng giá/Danh mục — chỉ xem` trên tab nhập Sales hiện hành là chức năng **xem file**, không phải import DB. Khi bổ sung phải thay bằng luồng thuộc Sản phẩm & SKU, không cho `commit_import` Sales viết dữ liệu giá vào doanh số.

## 5. Tra tên, đơn vị, giá; tách rõ doanh thu

Luồng tra mã khi xem trước/nhập Sales In/Out:

1. Từ hàng nguồn lấy **NPP, mã SKU nguồn, đơn vị nguồn, business_date** → tra alias theo NPP+ngày → trả **canonical SKU ID**; dùng ID này lấy **tên SKU và tên sản phẩm cha**. Không tự suy từ mã không duy nhất/tên gần giống.
2. Từ alias/đơn vị SKU xác định **tỷ lệ quy đổi** sang đơn vị chuẩn đúng một lần. Thiếu hoặc không rõ mapping => `Mã hàng chưa xác định`, không tự tính.
3. Nếu giao diện có yêu cầu gợi ý giá, tra **NPP, loại giá người dùng chọn hoặc nguồn định nghĩa rõ, SKU, đơn vị và ngày**, chỉ hiển thị giá khi một giá hợp lệ được xác định; trùng/thiếu => `Chưa có giá phù hợp` hoặc `Có nhiều giá, cần chọn nguồn`. Giá gợi ý có nhãn `Giá tham khảo` và provenance.
4. **Số tiền doanh thu thực hiện chỉ lấy từ chứng từ/nguồn giao dịch hợp lệ**. Giá niêm yết không chứng minh giao hàng, doanh số hoặc số lượng thực tế; không dùng giá*1/tự sinh chứng từ để tạo doanh thu. Dữ liệu có mỗi mã SKU + giá thuộc bảng giá, không phải Sales Out.
5. Manual Sales In/Out cũng phải khai nguồn thực tế, ngày, chứng từ/dòng, NPP, SKU, lượng và/hoặc trị giá theo contract ghi giao dịch. Không coi màn nhập tay là máy tạo đơn hàng, bán/đặt hàng ERP.

**Điểm còn cần owner xác nhận trước code:** danh sách loại giá tối thiểu, cách chọn mặc định khi có nhiều bảng giá, giá là theo đơn vị nào, thuế/chiết khấu có sẵn trong file, và trường hợp file doanh số chỉ có số tiền hay số lượng. Chưa có dữ liệu mẫu nào được xác minh là chuẩn chung mọi NPP.

## 6. Một contract dữ liệu cho nhập tay và nhập file

- Mỗi đối tượng/fact có ID nội bộ bất biến, scope NPP khi liên quan, thời điểm nghiệp vụ, bản ghi hiện hành, trạng thái và dấu vết lịch sử. **Origin** phân biệt thủ công và nguồn file. File giữ hash, sheet, row, header profile/revision; thủ công giữ local operator, thời điểm tạo/sửa, lý do điều chỉnh khi sửa fact.
- UI thủ công và Excel sử dụng cùng canonical DTO/domain validators/SQLite transaction, **khác adapter nguồn**; không viết business rule trong JSX để bypass Rust.
- Trùng: khóa tự nhiên theo loại nghiệp vụ và nguồn phải thiết kế riêng. Ví dụ Sales In/Out có NPP+loại+chứng từ+dòng+ngày theo nguồn xác nhận; import lặp file và nhập tay cùng chứng từ cần **cảnh báo/đối chiếu**, tránh tự cộng trùng, nhưng cũng không gộp hai dòng hợp lệ chỉ do trùng số chứng từ. Cần contract nguồn/định danh trước khi chọn unique constraints.
- Điều chỉnh thủ công phải có audit, old/new values và recalc có kiểm soát; nếu dữ liệu đã nằm trong batch Excel thì không sửa hàng nguyên thủy mà tạo override/phiên bản sửa có nguồn và phương thức đối chiếu. Thao tác xóa là ngừng/điều chỉnh theo quy định, không làm mất lịch sử hay fact FK.
- Các phép tính chỉ lấy record active/đã xác nhận, gắn nguồn. Giữ signed returns, integer VND, micro-unit, cách tính tồn snapshot không cộng dồn, lịch sử người quản lý theo business_date, doanh số chưa gán riêng.
- Khi chưa hỗ trợ loại dữ liệu ở native API, chỉ hiển thị `Chưa hỗ trợ nhập` đúng trạng thái; không tạo nút lưu giả hoặc lén ghi vào Sales In/Out.

## 7. Luồng thủ công theo nghiệp vụ (không thành ERP)

| Loại | Nhập tay | Ràng buộc/không làm |
| --- | --- | --- |
| Danh mục NPP | Mã, tên, khu vực, tuyến, trạng thái | Không xóa NPP/tuyến đã có fact; không quản lý hệ thống khách hàng/NPP như ERP |
| Danh mục nhân sự | SALES/SUP/ASM, NPP/tuyến, manager & mã nguồn từng NPP, ngày hiệu lực | Không cấp user/login; không đổi cây quản lý của kỳ trước |
| Sản phẩm/SKU/giá | Sản phẩm → SKU → đơn vị → mã NPP → loại/giá/ngày | Không lặp danh mục theo NPP; không tính bảng giá thành doanh thu |
| Sales In | Chứng từ bán vào đã phát sinh, ngày/NPP/SKU/dòng/đơn vị/số lượng/trị giá, trả hàng | Không sinh đơn mua/phiếu nhận kho theo giả định |
| Sales Out | Bán/giao đã ghi nhận, NVKD theo ngày, NPP/SKU/chứng từ/dòng, trả hàng, tuyến nếu có | Không sinh đơn đặt hàng/POS; NVKD không xác định để `Chưa gán` |
| XNT | Số liệu báo cáo kỳ/snapshot: tồn đầu, nhập, xuất, điều chỉnh, cuối kỳ khai báo | Không tạo phiếu kho vận hành; kiểm tồn cuối tính và chênh lệch |
| Chỉ tiêu | Giao chỉ tiêu theo tháng/NPP hoặc SALES/SUP, hiệu lực và nguồn | KPI thực hiện, tăng trưởng, phần trăm đạt tính tự động; không nhập KPI thành tích tay |
| Tổng quan/Báo cáo | Bộ lọc, mẫu xem/báo cáo và xuất dữ liệu | Không tạo giao dịch hay nhập tổng doanh thu không truy được về nguồn |

## 8. UI/UX và chất lượng

- Bố cục desktop theo skill `professional-ui-design` và `professional-frontend-qa` trong repo: tác vụ trước, một vùng làm việc chính, bảng dữ liệu dày vừa phải, góc nhấn/active rõ, không thẻ KPI giả khổng lồ hoặc bộ lọc disabled trang trí.
- Với screen nghiệp vụ: tiêu đề ngắn → thao tác chính `Thêm thủ công`/`Nhập Excel`/`Lịch sử` → bộ tìm kiếm/lọc thật → danh sách → panel chi tiết; sản phẩm dùng workspace riêng 6 section đã duyệt.
- Bảng Excel giữ chiều ngang với header cố định/dropdown rõ ràng, thông tin chung không lặp, trạng thái loading/empty/error/conflict và màn chi tiết lỗi. Modal/form không mất dữ liệu khi lỗi lưu; bàn phím, focus và hỗ trợ Windows zoom.
- QA thật ở 1366×768, 1920×1080 (và co cửa sổ), cả file dữ liệu lớn, unicode tiếng Việt, dropdown bị che, scroll ngang, test nhập thủ công + Excel trùng nguồn. Không đánh dấu PASS nếu chỉ đọc code, CI frontend hay ảnh mock.
- Dùng cùng Fluent UI 9 & design tokens hiện có; không đổi API/path chỉ để sửa chữ.

## 9. Tương thích kỹ thuật và migration

- Baseline đã có `001`, `002_local_operator`, `003_master_data`, `004_import_archives`; giữ nguyên tất cả và checksum, schema mới là **migration tiếp theo theo số/version chưa dùng** (dự kiến `005` hoặc sau đó), forward-only/additive, backup trước nâng cấp và test upgrade với dữ liệu thật mô phỏng.
- Chuẩn hóa catalog giá theo các thực thể tối thiểu tương đương `price_lists`, `price_list_items`/history, NPP scope, SKU FK, unit, loại giá, ngày áp dụng, nguồn và overlap guard. **Đề xuất contract**, không khẳng định SQLite hiện có giá hoặc đã chốt tên bảng/schema.
- Cần đánh giá nhóm/nhãn hàng: từ `product_families.category/brand` hiện là text, giữ tương thích và xác định migration danh mục lookup có phù hợp không. Tránh nâng cấp làm mất FK/facts. SQLite chỉ local, không copy bảng PostgreSQL của NPP-Platform.
- Nơi thao tác thủ công mới cần Rust IPC typed cho create/update/close, validate domain, optimistic concurrency/version và audit. Nhập Excel đi qua cùng domain commands, không hợp thức hóa số liệu bằng frontend.
- Không sửa SQLite người mua, không migration/restore production/manual data, không thay đổi Key Manager/R2, license hay installer trong batch lập kế hoạch. Tách release gate.

## 10. Lộ trình phụ thuộc — đề xuất thứ tự làm tiếp

| Ưu tiên | Lát cắt/Issue chỉ tạo sau owner duyệt Plan/contract | Kết quả nghiệm thu |
| --- | --- | --- |
| **P0 — CHỐT TRƯỚC** | Cập nhật Master Plan + thiết kế + contract: nguồn dữ liệu thủ công/file, giá, mã/đơn vị, ID và lịch sử, loại dữ liệu; rà soát file mẫu | Một nguồn sự thật; owner duyệt scope rõ; không code |
| **P1 — NỀN MÓNG** | Domain/schema giá + danh mục nhóm/nhãn/đơn vị cần thiết + tra giá/tên read API, migration an toàn | Không đổi `products.id`, giữ 001–004, kiểm mã cùng nhau giữa NPP, giá theo ngày đúng, Rust/SQLite tests |
| **P2 — ƯU TIÊN NGƯỜI DÙNG** | Workspace **Sản phẩm & SKU** Thiết lập nhanh đầy đủ + nhập Excel danh mục/mã NPP/bảng giá + history | Thêm thủ công và import hàng nghìn dòng dùng chung source; không tự tạo doanh thu |
| **P3 — CÙNG NGUYÊN TẮC** | Workspace **Nhà phân phối** và **Đội ngũ kinh doanh** tập trung + import danh mục của từng nghiệp vụ | Tạo/sửa tay và file thống nhất, lịch sử phân công đúng ngày |
| **P4 — GIAO DỊCH** | Ghi **Sales In/Out thủ công** cùng validator, khóa chống trùng & lịch sử, lookup tên/giá chỉ là tham khảo trong preview | Dữ liệu tay + Excel đối chiếu và tổng hợp không cộng trùng, không tạo đơn ERP |
| **P5 — BỔ SUNG** | XNT snapshot thủ công/Excel, nhập chỉ tiêu tay/Excel, report & KPI nguồn thật | Tồn kỳ, target, báo cáo không có số giả, reconciliation theo nguồn |
| **P6 — QA** | Đánh giá UX 10 tab, source lineage, test cỡ file, SQLite upgrade, Windows smoke + CI | PR nhỏ, CI xanh, owner duyệt merge từng PR; chưa đồng nghĩa release |

**Công việc tiếp theo sau khi Plan PR được owner đồng ý:** chốt contract schema/giá/Excel cho **Sản phẩm & SKU** rồi mở Issue implementation riêng về **nền danh mục + bảng giá + truy vấn**; sau đó ưu tiên **workspace sản phẩm + nhập danh mục/bảng giá**. Không làm cả 10 tab trong một PR, không đổi dữ liệu lịch sử kiểu big-bang.

**PR #33** là việc dọn bộ lọc giả (đang mở ở mốc audit), tách riêng; không đẩy code lên nhánh tài liệu hoặc ép merge chung.

## 11. Chưa xác minh / quyết định còn chờ

- Chưa được xác minh file thật từ các NPP (đặc biệt bảng giá 1.446 dòng, cấu trúc mã/loại giá/ngày và file có nhiều NPP); không khóa auto-guess cột trước QA nguồn.
- Chưa quyết định giá mặc định nào ưu tiên khi có nhiều bảng giá, có cho phép giá cấp theo kỳ không trùng không, và đơn vị áp giá (SKU lẻ/thùng) ra sao. Không lấy giá làm doanh thu.
- Chưa chốt khóa chống trùng giữa chứng từ nhập tay & Excel khi nguồn không có số chứng từ ổn định; phải xử lý bằng contract theo từng loại/nguồn và đối chiếu.
- Chưa quyết định sửa dữ liệu facts đã được chốt: amendment/override/revision ở mức dòng/batch và công thức tính lại kỳ; bắt buộc có quy tắc và test trước code.
- NPP/nhân viên/tuyến, XNT/Target Excel chưa có native commit contract tương ứng; không nói đã hỗ trợ.
- PR docs này chỉ chốt **bản đề xuất roadmap**, chưa phải owner duyệt từng scope triển khai, migration hoặc production. Sau owner phê duyệt mới chia Issue; mọi merge/deploy/migrate phải xin duyệt riêng.

## 12. Bằng chứng đã đọc (không suy đoán production)

- Supervisor: `apps/desktop/src/components/pageModel.ts` (10 tab), `MasterDataContent.tsx` + `src-tauri/src/master_data.rs` (CRUD master), `ImportContent.tsx` + `src-tauri/src/import_data.rs` (Excel Sales In/Out và chỉ xem bảng giá), `database/migrations/003_master_data.sql`, `004_import_archives.sql`.
- NPP-Platform: `npp-core/web/app/products/product-workspace.tsx`, `product-quick-setup-workspace.tsx`, `database/migrations/shared/014_price_lists_channel_resolution.sql` — chỉ dùng nguyên tắc UX, không copy ERP/khuyến mãi.
- QA/design guides thực đọc từ `.agents/skills/professional-ui-design/SKILL.md` và `.agents/skills/professional-frontend-qa/SKILL.md`. Đây là thiết kế lý luận từ source; chưa có kiểm thử UI Windows cho thiết kế mới.
