# M1.1 Desktop foundation

Tauri 2 + Rust in-process, React / Vite / TypeScript + Fluent UI 9. Minimal offline placeholder **only**. No SQLite runtime, local operator/onboarding, import, business IPC, licensing, R2 updater, or installer.

## Windows prerequisites
Node.js 22/npm 10, stable Rust MSVC toolchain, Visual Studio C++ build tools and WebView2 as documented by Tauri. Only after PR merge should owner sync GitHub main to local. Do not code at F:\1_A_Disk_D\Tool\NPP-Sup.

## Commands (repository root)
- npm ci
- npm run dev (web-only UI preview)
- npm run tauri -- dev (Windows native shell)
- npm run lint && npm run typecheck && npm test && npm run build
- cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --all -- --check
- cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --locked
- cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked
- npm run tauri -- build --no-bundle (Windows binary, **not** a distributable installer)

The bundle identifier `vn.salescenter.supervisor` is provisional. Tauri webview capabilities are empty (zero native API permissions). No business commands are registered. Data will live under Windows user app-data in M1.2; native IPC/onboarding is M1.3; installer is M1.4.

CI can confirm compilation/tests, not true visual launch/offline smoke. Do not mark Windows GUI QA complete until actually tested. In this ChatGPT environment the preferred skills `professional-ui-design` and `professional-frontend-qa` are unavailable; use manual desktop accessibility/keyboard/overflow review with measured evidence.

## M1.2 SQLite storage (native only; onboarding is M1.3)

The Tauri startup owns exactly one SQLite connection in Rust per Windows-user app-data directory (resolved through Tauri `app.path().app_data_dir()`). It holds a per-profile process lock for the lifetime of the window. SQLite uses WAL, foreign keys ON on the connection, a 5-second busy timeout and synchronous FULL. Do not copy a live database.

At initialization Rust applies historical SQL `database/001_initial_schema.sql` and forward migration `database/migrations/002_local_operator.sql` with SHA-256 migration checksums. An existing pre-ledger schema must match the supported baseline shape; unknown migrations, checksum modifications, or a legacy multi-profile database fail closed. Legacy/upgrade data receives an integrity-checked SQLite `VACUUM INTO` snapshot in the user's app-data `backups` directory **before schema changes**. On failure the migration transaction rolls back; a restore procedure will be added under the later backup/release milestones. No migration modifies a production/customer database from CI.

Only one `local_operator` row with id=1 may exist; acceptable types SALES/SUP/ASM. Staff remain records in `employees`, not app accounts. Native typed `AppDatabase::operator/create_operator` is Rust-only and **not exposed to the renderer**. M1.3 will add explicit allowlisted IPC and onboarding.

Tests run through `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked` and `python tests/smoke_migration.py`. Windows executable compilation does not prove GUI startup, offline smoke or persistence on a buyer workstation; those checks remain explicitly unverified until tested.
