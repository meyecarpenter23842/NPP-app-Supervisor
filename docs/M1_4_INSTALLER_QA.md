# M1.4 NSIS installer — QA and release boundary

- Tauri 2 NSIS currentUser bundle, app data located separately in per-user app-data. The WebView2 installer is bundled via offlineInstaller mode; availability on truly clean Windows 10/11 has **not** been tested.
- CI builds the NSIS installer, saves the SHA-256/commit version provenance, and attempts disposable Windows runner install, native startup, restart, uninstall, reinstall and SQLite fixture assertions. CI uses synthetic operator data and must not operate on buyer database files.
- The smoke script creates a synthetic operator **directly through SQLite** solely to isolate installer retention; it does NOT prove the actual onboarding UI/IPC interaction is working end-to-end.
- Version N→N+1 full binary updater simulation: NOT VERIFIED here; must be separately tested without conflating reinstall with update.
- Interactive 1366×768/1920×1080 screenshots, keyboard/focus, and true air-gapped Windows installation: NOT VERIFIED until tested on real Windows desktop. GitHub runner does not equal clean buyer machine.
- Missing test cases are not reported PASS; do not use artifact as customer release.
- No signing keys, license integration, release profile, R2 upload or production publish in M1.4.
- Authoritative CLI flags and config reviewed against https://v2.tauri.app/reference/config/ and https://v2.tauri.app/distribute/windows-installer/
