#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // M1.1 native shell only: no business IPC handlers or native plugins.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("unable to start Sales Supervisor");
}
