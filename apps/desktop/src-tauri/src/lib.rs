mod commands;
mod master_data;
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
            master_data::list_master_data,
            master_data::create_master_item,
            master_data::rename_master_item,
            master_data::set_master_active,
            master_data::create_master_link,
            master_data::end_master_link,
        ])
        .run(tauri::generate_context!())
        .expect("unable to start Sales Supervisor");
}
