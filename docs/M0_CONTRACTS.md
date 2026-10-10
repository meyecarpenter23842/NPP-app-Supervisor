# M0 — Decision Register & Release/Updater Contract (SALESCENTER)
**Ngày:** 2026-10-10 · **Trạng thái:** M0 planning; baseline đã được owner xác nhận một phần, chưa triển khai/kiểm chứng updater.
**Nguồn:** [Issue #2](https://github.com/meyecarpenter23842/NPP-app-Supervisor/issues/2) · [Master Plan](../MASTER_PLAN.md) · [Implementation Plan](IMPLEMENTATION_PLAN.md).

## 1. Quyết định đã được owner xác nhận (không bàn lại tùy tiện)
- **Kiến trúc:** Tauri 2 + Rust in-process + React/Fluent UI 9 + SQLite trong user app-data. Một Local Operator SALES/SUP/ASM, nhân sự cấp dưới chỉ là business data; không có login hoặc cloud business backend.
- **Roadmap:** M0–M5; Sprint 1 tách M1.1 (shell/CI), M1.2 (SQLite/operator), M1.3 (IPC/onboarding/UI), M1.4 (Windows installer/smoke). Chưa ủy quyền tạo Issue code/merge/phát hành.
- **Baseline nghiệp vụ (có thể điều chỉnh nếu dữ liệu thực chứng minh khác):** Sales In invoice/return, Sales Out delivered/return bỏ draft/cancelled, XNT reconciliation theo kỳ, KPI theo scope không double-count; attribution theo mã NVKD + NPP + business_date + lịch sử SUP; unresolved employee vào “Chưa gán”, không suy đoán.
- **Excel/CSV:** mapping cột linh hoạt theo NPP và kind, save import profile, staging/preview/validation/supersession, nguồn file/sheet/row và kiểm duplicate. Không khóa mapping chỉ bằng workbook minh họa.
- **License:** Key Manager toàn quyền quản lý key ngày/vĩnh viễn, license expiry, maxDevices, device revoke, offline grace theo chính sách/entitlement thực tế; Supervisor không hardcode bất cứ thời hạn, số máy hay grace days. Không xóa SQLite/backups khi license không hợp lệ.
- **Owner cung cấp:** Key Manager application `SALESCENTER` (cần kiểm tra app_code/app_id trả về API), R2 bucket `sales-center`, public R2 base `https://pub-6c5811b7ea194f4e88278cbda2c050b0.r2.dev`. Android signing không dùng cho Windows; keystore/password Android để trống. **Chưa xác minh** Key Manager profile đã lưu, quyền R2, mạng, manifest hiện hữu hoặc upload thành công.

## 2. Phân biệt API License và ký bản cập nhật
- **REPO-VERIFIED ở Key Manager main `97c1617`:** Public License API `/api/v1/license/activate`, `validate`, `heartbeat`, `deactivate` dùng `appCode` / `licenseKey` / `deviceId` / `appVersion`; success trả `serverTime`, application `offlineGraceSeconds`, license `expiresAt`, `maxDevices`; khi signing enabled/grace > 0 có `offline.token`/`keyId`/`offlineValidUntil` ký Ed25519.
- **Runtime còn UNVERIFIED:** app_code chính thức của `SALESCENTER` trong License API, application UUID, base API URL, key ring Ed25519 `kid`, signing enabled, offline grace hiện hành, device policy, revoke/error scenarios.
- **Release signing KHÁC license signing.** Tauri 2 updater bắt buộc artifact signature với updater public key trong app; private key/password được bảo vệ ở release environment trên máy build, không trong Git, không trong React, không trong SQLite, không gửi vào chat. Không sử dụng Android keystore để ký Windows updater.
- Khi gặp lỗi offline signing/clock rollback, yêu cầu online revalidate; không tạo thời hạn giả hoặc xóa dữ liệu. Grace do Key Manager trả về, **không fix 7/14/30 ngày** trong Supervisor.

## 3. R2 publish target (owner cung cấp vs. đề xuất kỹ thuật)
| Field | Giá trị / trạng thái |
| --- | --- |
| Key Manager application | `SALESCENTER` — OWNER-CONFIRMED; API app_code chưa thử |
| R2 bucket | `sales-center` — OWNER-CONFIRMED; chưa thử access |
| R2 public base | `https://pub-6c5811b7ea194f4e88278cbda2c050b0.r2.dev` — OWNER-CONFIRMED; chưa thử live |
| R2 prefix | Rỗng — PROPOSED, chưa xác nhận profile đã lưu |
| Static pointer | `latest.json` tại root/prefix — PROPOSED theo Tauri 2, cần test |
| Release artifacts | Windows NSIS `*.exe` + signature `*.exe.sig` + `latest.json` — PROPOSED, chưa build |
| Key Manager version file/field | `package.json` / `version` — PROPOSED; Supervisor chưa có package.json |
| Build command / output | `pnpm run release:package` / `dist\windows-release` — PROPOSED, chưa tạo command/dir |
| Source directory | Disposable staging checkout từ **approved merged SHA**, không phải `F:\1_A_Disk_D\Tool\NPP-Sup` — REQUIRED, path phải có thật khi publish |
| R2 credential | Saved Key Manager DPAPI profile hoặc configured environment; **không được khẳng định đã chọn/kết nối** |
| Publish | Artifacts trước, static pointer cuối; chỉ sau CI/smoke/owner release approval |

**Cảnh báo:** Màn hình Key Manager có defaults `*.blockmap, latest.yml` của Electron; chúng **không** chứng minh tương thích Tauri updater. Không nhầm `.sig` của Tauri với Android keystore/password hay Key Manager offline license token.

## 4. Target static manifest của Tauri 2 (đề xuất, chưa phát hành)
Tauri updater v2 static JSON yêu cầu `version` và cho mỗi platform có `url`, `signature`. Signature là **nội dung** file `.sig` của đúng artifact, KHÔNG phải đường dẫn; `notes`/`pub_date` là tùy chọn. Ví dụ schema có placeholder, KHÔNG phải một release thật:

```json
{
  "version": "0.0.0-example",
  "notes": "Example only — do not publish",
  "platforms": {
    "windows-x86_64": {
      "url": "https://pub-6c5811b7ea194f4e88278cbda2c050b0.r2.dev/<versioned-installer.exe>",
      "signature": "<exact-text-from-matching-installer.exe.sig>"
    }
  }
}
```

- Trước publish, replace tất cả placeholder bằng artifact/version hiện có; validate strict SemVer, Tauri static schema, target platform, URL HTTPS, đúng tên file, signature và checksum. Không cho manifest placeholder lọt vào R2.
- Tauri v2 `createUpdaterArtifacts: true` cho NSIS tạo installer `.exe` + `.exe.sig`. Cần build Windows thật và test updater ký xác thực; không giả định chỉ có `latest.json` là đủ.
- Key Manager external release flow **thực tế** validate SemVer/source version và manifest filename/version một phần, có thể chỉnh JSON notes; không kiểm chứng đầy đủ nested `platforms.*.signature` hoặc chữ ký cập nhật của Supervisor. Vì vậy **build script/CI phát hành của Supervisor** phải sinh và verify manifest sau khi Key Manager bump version (và trước publish).
- Public URL mục tiêu **nếu** prefix rỗng: `https://pub-6c5811b7ea194f4e88278cbda2c050b0.r2.dev/latest.json` (chưa thử truy cập). Không ghi URL này là đang hoạt động.
- Tham khảo Tauri 2: https://v2.tauri.app/plugin/updater/

## 5. Luồng phát hành & an toàn dữ liệu — gate sau M0
1. Owner phê duyệt **merge PR code**, CI xanh. Owner `git pull --ff-only origin main` về local chỉ sau merge.
2. Release worker tạo **staging checkout riêng** tại đúng merged SHA; không mutate local working copy/source chính. Key Manager chỉ được trỏ `sourceDir` vào staging, không trỏ local repo sync.
3. Key Manager điền new SemVer/release notes, bump metadata **trong staging**, chạy build command; script đảm bảo đồng bộ version của Tauri/Cargo/package; khóa ký updater lấy từ nguồn protected local environment, không commit.
4. Sinh Windows NSIS `.exe`, `.sig` và `latest.json` đầy đủ; verify executable, version, size, hash SHA-256, .sig bằng public key và manifest URL trước khi publish. Chữ ký số Windows Authenticode (nếu yêu cầu) là **lớp riêng**, không thay thế updater signature.
5. Key Manager validate/UPLOAD_ARTIFACT, cuối cùng UPLOAD_MANIFEST; nếu bất kỳ gate nào fail, không advance pointer. Cần smoke install/update trên máy test trước khi release thật và owner duyệt **riêng**.
6. Trước update, checkpoint/backup SQLite nhất quán (online backup hoặc VACUUM INTO), verify integrity/migration compatibility; shutdown kết nối, update binary không đụng user app-data. Lỗi migration/installer phải giữ dữ liệu và phương án rollback; tuyệt đối không chạy binary cũ lên DB schema không tương thích.
7. Test trên Windows: clean install, offline startup, signed check/download/install, restart, N→N+1 cùng SQLite, DB checksum/record count và restore failure. `READY`/CI docs PASS không thay thế Windows smoke.

## 6. Những việc vẫn BLOCKED / điều kiện để kết thúc M0
- **Excel thực tế:** cần mẫu đã ẩn dữ liệu nhạy cảm để xác minh sheet, cột, ngày ghi nhận, chứng từ, employee alias, target/XNT. Baseline đã chốt nhưng mapping nguồn chưa PASS; chỉ block Issue phụ thuộc M2/M3 nếu owner cho phép M1 độc lập.
- **License runtime:** xác minh Key Manager `SALESCENTER` app_code/app_id, API URL, offline signer/key ring, error flows mà không ghi secrets vào chat. Key policy đã khóa, không phải hỏi lại grace số ngày.
- **Release runtime:** xác minh saved profile/bucket/prefix và quyền r2.dev, staging path thật, build command/artifact output, updater key pair/public key, .sig/manifest, NSIS/CI & smoke. Chưa có Supervisor app nên chưa thể PASS.
- **Owner gate:** review PR tài liệu, CI baseline xanh rồi quyết định merge. M0 chỉ đánh dấu hoàn thành các điều kiện đã có bằng chứng; **không tạo Issue code hoặc publish khi chưa có yêu cầu rõ**.

## 7. Source/evidence
- Supervisor main baseline `77b5f7054c55721140a8c481930ab5cc0399e2be`; Issue #2 owner decisions (2026-10-10).
- Key Manager main `97c1617ab8a6d5217acd695cb824f7f6d78dbb4e`: `server/src/public-license.mjs`, `server/src/license-service.mjs`, `docs/offline-license-v1.md`, `src-tauri/src/external_release.rs`, `docs/build-release-updater.md`.
- Official Tauri 2 updater docs: https://v2.tauri.app/plugin/updater/
