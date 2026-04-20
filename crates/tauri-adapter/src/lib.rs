pub mod commands;
pub mod bootstrap;

use tauri::Manager;

pub fn run() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::invoice::create_invoice,
            commands::invoice::list_invoices,
            commands::invoice::post_invoice,
        ])
        .setup(|app| {
            // Initialize app state with DI container
            let app_state = tauri::async_runtime::block_on(
                bootstrap::container::build_app_state()
            ).expect("Failed to create app state");
            app.manage(app_state);
            Ok(())
        })
}
