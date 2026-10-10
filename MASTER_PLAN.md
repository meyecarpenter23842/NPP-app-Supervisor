# MASTER PLAN — Sales SUP/ASM Desktop (FMCG)
**Trạng thái:** Architecture baseline đã được owner duyệt và merge tại PR #1; hợp đồng M0 bổ sung vẫn ở trạng thái review, chưa cho phép code/release.
**Ngày:** 2026-10-10 | **Repository:** meyecarpenter23842/NPP-app-Supervisor | **Mốc main đã audit:** 77b5f7054c55721140a8c481930ab5cc0399e2be (PR #1 merged)

## 0. Quyền ưu tiên & phạm vi quyết định
- Master Plan này là quyết định nguồn ưu tiên cao nhất cho thiết kế ứng dụng SUP/ASM. docs/MVP_SPEC.md và database/001_initial_schema.sql là baseline hiện hữu, **chưa được coi là đã cập nhật** để đáp ứng mọi quyết định ở đây.
- Thứ tự phát triển: audit GitHub → đề xuất/chốt Master Plan → owner duyệt → mới tạo các Issue lập trình → branch từ main mới nhất → code/test/commit/push → PR → review + required CI xanh → owner duyệt merge → merge → owner tự pull --ff-only về local.
- **Không code trực tiếp ở F:\1_A_Disk_D\Tool\NPP-Sup**. GitHub là nguồn chuẩn; local là nguồn cài/chạy/build-phát hành từ bản đã merge. Không force-push, không tự merge/deploy/migrate production.
- NPP-Platform (binhnxwjfjxm/NPP-Platform) chỉ là nguồn tham khảo nghiệp vụ; không đưa các backend của NPP vào app này và không sửa NPP-Platform.

## 1. Sản phẩm & ranh giới một người sử dụng
- Ứng dụng Windows Desktop offline-first, lấy Excel/CSV làm nguồn đầu vào. Quản lý NPP, SKU, tuyến, nhân sự kinh doanh, Sales In/Out, XNT, chỉ tiêu và phân tích.
- **Mỗi installation/profile dữ liệu chỉ có 01 Local Operator** là người mua và trực tiếp sử dụng, loại SALES, SUP hoặc ASM; không tạo tài khoản người dùng cấp dưới, không có login/role RBAC nội bộ, session hoặc phân quyền đa người dùng.
- Thay đổi loại SALES/SUP/ASM là thay đổi góc nhìn và cấu hình nghiệp vụ của operator, không sinh account mới và không cấp quyền truy cập dữ liệu cloud.
- Nhân viên trong bảng employees là **business subjects** để gắn doanh số, tuyến, NPP và người quản lý. Họ không bao giờ có credential, password, app session hay quyền đăng nhập app.
- Bản cài offline không thể bảo mật cứng dữ liệu với admin Windows có toàn quyền máy. Mỗi profile Windows sở hữu một vùng dữ liệu cục bộ; không giả định các profile hoặc máy khác được đồng bộ.

## 2. Desktop, backend và DB đều theo máy cài
- Tauri 2 + Rust đóng gói backend nghiệp vụ trực tiếp trong process ứng dụng, React + TypeScript + Vite + Fluent UI v9 cho giao diện. Không yêu cầu Node.js, Python, PostgreSQL, VPS hay khởi chạy backend riêng ở máy người mua.
- SQLite là cơ sở dữ liệu nghiệp vụ **cục bộ**. SQLite và migrations đi theo bản cài; database thực tế được tạo ở app-data path, không ở thư mục Program Files, installer, source repo hoặc cạnh file exe.
- Ưu tiên native Tauri commands giới hạn quyền; chỉ chọn sidecar local nếu sau spike chứng minh cần thiết. Nếu sidecar, nó phải bundled và quản lý vòng đời tự động; không expose API cho mạng LAN.
- Không dùng backend/DB cloud cho nghiệp vụ; **ngoại lệ có kiểm soát:** HTTPS Key Manager License API khi kích hoạt/refresh license và R2 endpoint khi người mua kiểm tra/tải update. Mất mạng không làm hỏng dữ liệu offline.
- Cơ sở dữ liệu mở trong WAL mode, bật foreign keys, busy timeout, migration version/checksum; thao tác nhập theo transaction và idempotent; tiền/số lượng giữ số nguyên có quy đổi, không dùng JS float để làm nguồn sự thật.

## 3. Cây quản lý nhân sự là quan hệ nghiệp vụ
Ví dụ operator ASM quản lý SUP A → SALES A1, A2 và SUP B → SALES B1; còn operator SALES chỉ phân tích kết quả kinh doanh chính mình.
- Canonical staff ID, employee code, name, level (SALES/SUP/ASM), parent/manager relation, distributor/territory/route assignments; lưu hiệu lực from/to để tái tạo đúng tổ chức ở ngày đơn hàng phát sinh.
- Quan hệ manager có lịch sử hiệu lực; không chỉ lưu một manager_id mutable khiến thay đổi SUP hôm nay kéo sai doanh số tháng trước.
- Mã NVKD của Excel phải map qua alias theo NPP và khoảng hiệu lực, tránh trùng mã giữa các NPP. Có thể gắn owner operator vào employee nếu người mua là Sales; không sinh login cho nhân viên.
- Sales Out cần dữ liệu source employee code, NPP, ngày bán và chứng từ/SKU để biết doanh số thuộc ai. Ưu tiên mã NVKD trực tiếp từ nguồn và mapping đã xác nhận; không suy đoán dựa trên tên hay phân bổ đều. Nếu không giải quyết được thì hiển thị “Chưa xác định nhân viên” cùng số tiền/sản lượng không được gán.
- Khi drill-down theo SUP, chỉ cộng NVKD thuộc quyền **ở business_date của dòng Sales Out**, không dùng sơ đồ tổ chức hiện tại áp ngược quá khứ. Thay đổi mapping cần audit; phải hỗ trợ danh sách lỗi/unmapped trong Import Center.
- Dữ liệu master nhân sự do local operator nhập/chỉnh sửa/import; không có HR, payroll, chấm công hay login cấp dưới ở MVP.

## 4. Canonical nghiệp vụ & KPI
- Sales In: hàng công ty **đã ghi nhận bán vào NPP** theo chứng từ và kỳ; invoice (+), return/credit (-). Không coi PO chưa giao hoặc Sales In là số lượng NPP đã nhập kho.
- Sales Out: NPP đã bán/giao ra điểm bán theo tiêu chuẩn ghi nhận được cấu hình và công bố; delivered (+), return (-); loại draft/cancelled, không lấy đơn chưa giao làm số thực hiện.
- XNT kỳ: tồn đầu + nhập thực nhận − xuất thực tế ± điều chỉnh = tồn cuối tính toán; đối chiếu với tồn cuối khai báo. Snapshot theo kỳ không cộng dồn tồn cuối của các kỳ; chỉ so sánh liên kỳ nếu chuỗi dữ liệu đủ.
- KPI: target theo tháng/cấp được chọn (NPP hoặc Sales hoặc SUP); không cộng cùng một doanh số hoặc target giữa cấp quản lý và cấp nhân viên. Tỷ lệ đạt, growth, DOH, forecast đều nêu rõ tiêu chuẩn ngày/kỳ, nguồn, ngày cập nhật; dữ liệu thiếu hiển thị “Chưa đủ dữ liệu”, không thay bằng 0.
- Money: integer VND. Quantity: integer micro (10^6 base unit). Mã có số 0 đầu luôn xử lý dạng text; SKU, NPP, employee có mã canonical/alias; nguồn import giữ lineage.
- Cần phân biệt doanh số chưa được gắn NVKD với tổng Sales Out của NPP; hiển thị riêng “Chưa gán” và reconciliation để tổng NVKD + chưa gán = doanh số NPP theo cùng kỳ.

## 5. Excel/CSV Import Center (P0)
1. Chọn data kind: NPP, SKU, nhân viên, quan hệ quản lý/phân công, Sales In, Sales Out, XNT, Target.
2. Đọc tệp an toàn, nhận diện sheet/encoding, yêu cầu người dùng xác định tiêu chuẩn ghi nhận, NPP/kỳ áp dụng.
3. Map cột vào canonical schema, xem trước dữ liệu. Giữ code text và provenance file hash, sheet, row, source version.
4. Validate: thiếu/sai mã, trùng chứng từ, duplicate/re-import, ngày ngoài kỳ, đơn vị/chuyển đổi, kiểu dữ liệu, employee mapping/manager lineage, chồng kỳ XNT, tiền/quantity overflow và formula/external links rủi ro.
5. Cung cấp bảng lỗi theo sheet/dòng/cột để sửa; lỗi chặn không commit; hỗ trợ manual mapping có audit, không tự đoán.
6. Staging → validation → atomic commit → activate batch; import phiên bản điều chỉnh supersede batch cũ có lịch sử. Không cộng trùng, không xóa trace gốc.
7. Báo cáo nào cũng cần trạng thái dữ liệu (VALID/PARTIAL/MISSING/STALE/CONFLICT), kỳ và batch nguồn. Export Excel ghi filters, kỳ, thời điểm, version và nguồn.

## 6. Database/migrations — design targets (chưa đổi schema ở PR Master Plan)
- Giữ các thực thể hiện có: distributors, products, aliases, employees, assignments, import_batches/issues, sales_in_facts, sales_out_facts, inventory_period_facts, target_facts, audit_events, report views.
- **Phải thay đổi** app_profiles thành singleton local_operator (hoặc giới hạn tối đa 1 bản ghi), role gồm SALES/SUP/ASM; tránh table users, local login/password.
- **Phải bổ sung** employee_hierarchy_assignments(effective_from, effective_to, employee_id, manager_employee_id), với constraint chống vòng quản lý và khoảng hiệu lực xung đột. employee_distributor_assignments giữ hiệu lực theo NPP.
- **Phải xác định** namespace employee external code per NPP và mapping/reconciliation; không ghép tên khi thiếu mã. Validate không gán SUP sai vì thiếu chứng từ/ngày.
- Bổ sung migration versioning, unique/revision lineage ở imports, app-settings cho license/app version và data-export provenance khi thực thi. Secrets hoặc license signing private key không nằm trong SQLite.
- Schema SQL baseline hiện tại chứa app_profiles chỉ SUP/ASM; code DTO hiện tại Role chỉ SUP/ASM. **Chưa đạt kiến trúc mới** và phải được sửa đồng bộ trong Issue triển khai riêng, kèm migration/rebuild tables và tests.
- Backup phải sử dụng SQLite online backup/VACUUM INTO an toàn với WAL; Restore chỉ sau kiểm tra integrity/schema/version, transaction-safe, giữ bản backup trước khôi phục. Không copy bừa *.db khi còn kết nối.

## 7. UI/UX Office Enterprise (P0)
- Cửa sổ tối ưu Windows màn hình văn phòng: sidebar điều hướng, top toolbar kỳ/NPP/tuyến/nhân viên, filter chips, saved views, DataGrid virtualized, biểu đồ, drill-down về chứng từ và Excel nguồn.
- Onboarding lần đầu: thông tin local operator, chọn SALES/SUP/ASM, chọn vùng dữ liệu và nhập template đầu tiên. Không có màn hình tạo tài khoản cho Sales/SUP/NVKD cấp dưới.
- Screens P0: Dashboard, Import Center, Sales In, Sales Out, XNT/DOH, NPP, Nhân sự & phân cấp, KPI/Target, SKU Analytics, Reports, Settings/Backup/License.
- Cấu hình operator SALES hiển thị nghiệp vụ hợp lý cho nhân viên đơn lẻ, SUP cho đội/1-nhiều NPP, ASM cho toàn khu vực được cấu hình. Không lấy “role” của local operator làm cơ chế chặn truy cập server.
- Không dựng “đơn hàng” do app tự bán hàng; app chỉ phân tích dòng Sales Out được import. Thống nhất văn bản tiếng Việt; bảng có loading/empty/error/source states, hỗ trợ tìm nhanh và keyboard.

## 7A. Bắt buộc đọc GPT Skills trước khi làm UI/UX (UI/UX SKILL GATE)
- **Trước khi thiết kế giao diện, sửa component/layout, làm Dashboard, hoặc review UI/UX:** agent/ChatGPT phải kiểm tra danh sách skill thực sự có trong môi trường làm việc, **đọc nội dung SKILL.md/instructions của skill phù hợp trước khi viết code hoặc nhận xét thiết kế**. Không chỉ nêu tên skill rồi tự nhận đã áp dụng.
- **Ưu tiên skill theo quy tắc dự án:** `professional-ui-design` cho layout/design system/typography/spacing/Office Enterprise, và `professional-frontend-qa` cho browser/desktop UI QA, responsive, accessible, interaction, overflow, lỗi visual. **Chỉ đọc và sử dụng nếu thật sự khả dụng** trong môi trường agent tương ứng; nếu không khả dụng, ghi rõ “không có skill này”, áp dụng checklist thủ công và không tuyên bố đã đọc.
- Skill GPT hiện có thể sử dụng trong một số môi trường (tùy lần chạy): `build-dashboard`/`visualize-data` cho biểu đồ/độ rõ KPI và `react-best-practices` cho chất lượng component React/TypeScript. Không ép dùng skill dành cho backend/cloud vào desktop local và không ép thay design system đã chốt chỉ vì skill đề cập thư viện khác.
- UI/UX implementation phải tuân thủ Fluent UI 9, desktop-first Windows văn phòng, nhất quán component token, typography, bảng dữ liệu dày thông tin nhưng dễ đọc, keyboard navigation, hover/focus/disabled/loading/empty/error states, contrast/accessibility, data state & nguồn KPI minh bạch.
- **UI/UX QA là gate của PR:** agent tự kiểm tra màn hình thực tế ở ít nhất 1366×768 và 1920×1080, độ co giãn cửa sổ, zoom/font scale, DataGrid dài, dữ liệu trống/lỗi, modal/filter/import flow, keyboard và visual consistency; đính bằng chứng (ảnh/screen recording hoặc QA report phù hợp) và log test. Không đánh PASS chỉ bằng nhìn code hoặc mockup.
- Mỗi Issue có UI/UX phải ghi trong mô tả: skill đã đọc (tên và phiên bản/nguồn nếu có), skill thiếu, tiêu chí thiết kế áp dụng, test/QA đã chạy, lỗi và cách xử lý. ChatGPT review theo bằng chứng, không tự nhận “QA done” nếu chưa kiểm nghiệm được.
- Với bug UI: tái hiện → xác định root cause → sửa đúng tầng → regression test; không thay đổi API/business contracts chỉ để chỉnh nhãn hoặc bố cục hiển thị.

## 8. Key Manager licensing — đã audit, phạm vi tích hợp chưa có
Repo tham khảo: meyecarpenter23842/key-manager (main tại 97c1617ab8a6d5217acd695cb824f7f6d78dbb4e khi audit).
- Key Manager Admin là app Tauri; Admin API/License API hoạt động online riêng. Offline entitlement ký Ed25519 nằm trong docs/offline-license-v1.md: client chỉ nhúng public key, kiểm signature, app/license/device binding và offline_valid_until.
- Local app chỉ cần client License API và local signed entitlement; không mang PostgreSQL URL, Key Manager Admin API token, secret R2 hoặc private signing key vào app.
- **Owner chốt 2026-10-10:** Key Manager là nguồn chính sách duy nhất: key ngày/vĩnh viễn, hết hạn, giới hạn thiết bị, thu hồi và offline grace theo entitlement/config thực tế; Supervisor không hardcode số ngày, số thiết bị hay tự xây chính sách license. Khi grace hết cần online revalidate; không xóa SQLite/backup.
- Định danh người mua/license KHÁC với nhân viên sales được quản lý; activation không tạo user nội bộ. Quy định rõ các trạng thái license, retry, clock rollback, revoked/offline expiry; không xóa dữ liệu khi license không hợp lệ.
- Cần audit contract Public License API thực tế, app_code, device binding, grace, key rotation trong Issue tích hợp trước khi code; không khẳng định đã chạy end-to-end.

## 9. Key Manager build/update + R2 — ranh giới phát hành
- Repo Key Manager hiện có external app release manager (docs/build-release-updater.md): cấu hình source, version file, build cmd, output, artifact patterns, manifest patterns, R2 bucket/prefix và credential profile mã hóa DPAPI; upload installer/artifacts trước, publish-pointer (latest.json, latest.yml ...) cuối cùng. Có validate SemVer và versioned artifact.
- Đây là năng lực **phát hành** đã hiện hữu của Key Manager, KHÔNG có nghĩa app SUP/ASM đã có updater tương thích. Phải triển khai client updater của riêng ứng dụng, xác minh manifest schema, tải artifact, kiểm SHA-256 và signature/code signing trước cài, có retry/rollback an toàn.
- Luồng sau merge: GitHub main SHA được duyệt → owner pull --ff-only về local → tạo **build staging workspace/copy** từ SHA đã merge → Key Manager build trên staging, không sửa source Git local đã đồng bộ → verify installer + test → owner duyệt phát hành → upload R2 artifacts → publish manifest cuối.
- Cần spike Key Manager external release profile để xử lý version bump trên staging (vì hiện tại KM có thể sửa metadata source để build). Không tự sửa Key Manager, không đổi luồng production cho ứng dụng khác nếu chưa có Issue/phê duyệt riêng.
- Installer/updater không xóa database, config, backups trong app-data. Trước SQLite migration: backup có kiểm integrity, preflight disk/compatibility, shutdown DB, áp dụng schema migration theo thứ tự, verify/post smoke; fail thì giữ data và phương án restore. Không cho binary cũ mở DB schema không còn tương thích.
- R2 chứa artifact/manifest phát hành, không chứa DB hay dữ liệu kinh doanh NPP. Key Manager quản lý release metadata và license online, không phải backend dữ liệu bán hàng.

## 10. Quy trình chất lượng & sản xuất
- CI phải có test schema/migration, import/alias/role consistency, report reconciliation, Rust fmt/check/test, frontend lint/typecheck/test/build, Windows installer build, update manifest test, smoke offline and non-destructive update.
- Không “CI xanh” bằng cách bỏ qua job. Định nghĩa required checks trước PR merge. Tài liệu-only PR dùng workflow tối thiểu kiểm schema baseline + tồn tại tài liệu; release production cần workflow kiểm chất lượng chuyên sâu sau này.
- Dữ liệu thử nghiệm mô phỏng, không commit bí mật, API key, DB người mua hay Excel kinh doanh thật; cấm renderer direct filesystem rộng và cấm shell tùy ý.
- Mọi bug cần tái hiện, root cause, fix đúng lớp, regression; review logic, diff, contract, CI và test trước merge. Owner duyệt merge, owner duyệt release R2 là 2 gate riêng.

## 11. Lộ trình phát triển và Definition of Done
Chi tiết milestone/checklist/acceptance trong docs/IMPLEMENTATION_PLAN.md.
- S0: chốt Master Plan, CI foundation + hợp đồng SQLite/import/operator/license-release, không viết app trước gate.
- S1: Tauri/Rust/SQLite, fluent shell, operator singleton, packaging smoke, offline startup.
- S2: master nhân sự và NPP/SKU/tuyến + phân cấp hiệu lực; import engine, mapping, batch revisions.
- S3: Sales In/Out, XNT, KPI, multidimensional dashboard/report và reconciliation.
- S4: Key Manager license client, updater/R2 compatibility, backup/migration safe, installer hardening.
- S5: Windows E2E real import/update/restore/offline QA + owner release acceptance.
- P1 chỉ sau MVP: forecast cảnh báo nâng cao, outlet coverage sâu, coaching, API NPP integration (nếu có yêu cầu riêng).

## 12. Decision register M0 (chi tiết trong docs/M0_CONTRACTS.md)
- **ĐÃ CHỐT:** kiến trúc offline, một operator SALES/SUP/ASM; roadmap M0–M5 và Sprint 1 M1.1–M1.4.
- **ĐÃ CHỐT baseline (được chỉnh sau khi kiểm chứng dữ liệu):** định nghĩa Sales In/Out/XNT/KPI, nhân sự lịch sử, dữ liệu chưa gán; Excel/CSV mapping linh hoạt theo NPP và data kind.
- **ĐÃ CHỐT license policy:** Key Manager là nguồn chính sách; Supervisor chỉ tiêu thụ Public License API/signed offline entitlement, không hardcode hạn/số máy/grace.
- **OWNER CUNG CẤP:** ứng dụng Key Manager `SALESCENTER`, bucket R2 `sales-center`, public base URL `https://pub-6c5811b7ea194f4e88278cbda2c050b0.r2.dev`; chưa xác minh profile đã lưu hoặc endpoint live.
- **M0 CHƯA XÁC MINH:** mapping Excel thực tế; license environment/app_id/signing public keys; prefix/config R2 đã lưu; Tauri updater manifest/signature, release output/build command và thử nghiệm end-to-end. Các hạng mục này vẫn là gate cho Issue phụ thuộc; không đánh dấu DONE chỉ bằng PR tài liệu.
- **Không code app, tạo implementation Issue, merge hoặc publish R2** trước các phê duyệt tương ứng.

## 13. Trạng thái xác minh (2026-10-10)
- ĐÃ XÁC MINH: PR #1 merged tại 77b5f705; SQL/TS baseline thiếu SALES/singleton/hierarchy; Key Manager main 97c1617 hỗ trợ Public License API và external R2 publish (chưa chứng minh tương thích Tauri updater).
- CHƯA XÁC MINH: Supervisor executable/CI Windows, license API môi trường thực, Key Manager release profile đã lưu, quyền R2/upload/download, manifest+signing updater, installer và release readiness. Bucket/base URL do owner cung cấp, chưa test.
- KHÔNG THỰC HIỆN TRONG PR KẾ HOẠCH: mutation DB khách hàng, build production, phát hành R2, merge main, chỉnh file local.
