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
