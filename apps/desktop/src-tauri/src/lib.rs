mod catalog_data;
mod catalog_import;
mod commands;
mod import_data;
mod import_parse;
mod master_data;
mod sku_analytics;
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
            catalog_data::list_catalog,
            sku_analytics::list_sku_metrics,
            catalog_import::preview_catalog_import,
            catalog_import::commit_catalog_import,
            catalog_import::list_catalog_import_history,
            catalog_data::create_catalog_option,
            catalog_data::create_product_family,
            catalog_data::assign_family_catalog,
            catalog_data::create_price_list,
            catalog_data::create_price_item,
            catalog_data::close_price_item,
            catalog_data::resolve_catalog_sku,
            commands::get_operator,
            commands::create_operator,
            commands::update_operator,
            master_data::list_master_data,
            master_data::create_master_item,
            master_data::rename_master_item,
            master_data::set_master_active,
            master_data::create_master_link,
            master_data::end_master_link,
            import_data::inspect_import_file,
            import_data::preview_import,
            import_data::commit_import,
            import_data::list_import_history,
            import_data::get_import_mapping_profile,
            import_data::save_import_mapping_profile,
        ])
        .run(tauri::generate_context!())
        .expect("unable to start Sales Supervisor");
}
