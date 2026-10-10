mod commands;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            let app_data_dir = app.path().app_data_dir()?;
            let storage = storage::AppDatabase::open(&app_data_dir)?;
            app.manage(storage);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health,
            commands::get_operator,
            commands::create_operator,
            commands::update_operator,
        ])
        .run(tauri::generate_context!())
        .expect("unable to start Sales Supervisor");
}
