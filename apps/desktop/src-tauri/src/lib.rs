pub mod commands;
pub mod bootstrap;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::invoice::create_invoice,
            commands::invoice::list_invoices,
            commands::invoice::post_invoice,
        ])
        .setup(|app| {
            // Initialize app state with DI container
            let app_state = bootstrap::container::build_app_state();
            app.manage(app_state);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
