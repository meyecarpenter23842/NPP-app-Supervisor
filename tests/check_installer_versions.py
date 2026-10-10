"""Reject cross-component package version mismatch in Windows installers."""
import json
from pathlib import Path
import tomllib

root = Path(__file__).resolve().parents[1]
workspace = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
desktop = json.loads((root / "apps/desktop/package.json").read_text(encoding="utf-8"))["version"]
tauri = json.loads((root / "apps/desktop/src-tauri/tauri.conf.json").read_text(encoding="utf-8"))
cargo = tomllib.loads((root / "apps/desktop/src-tauri/Cargo.toml").read_text(encoding="utf-8"))["package"]["version"]
assert workspace == desktop == cargo == tauri["version"], (workspace, desktop, cargo, tauri["version"])
assert tauri["bundle"]["targets"] == ["nsis"]
assert tauri["bundle"]["windows"]["nsis"]["installMode"] == "currentUser"
assert tauri["bundle"]["windows"]["webviewInstallMode"]["type"] == "offlineInstaller"
print("PASS: installer versions, NSIS user install, embedded offline WebView2 mode")
