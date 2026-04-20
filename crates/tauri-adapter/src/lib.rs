pub mod commands;
pub mod bootstrap;

use tauri::Manager;

pub fn run() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Invoices (Sales)
            commands::invoice::create_invoice,
            commands::invoice::list_invoices,
            commands::invoice::post_invoice,
            // Suppliers
            commands::supplier::create_supplier,
            commands::supplier::list_suppliers,
            commands::supplier::get_supplier,
            commands::supplier::delete_supplier,
            // Purchase Invoices
            commands::purchase::create_purchase_invoice,
            commands::purchase::list_purchase_invoices,
            commands::purchase::post_purchase_invoice,
            // Payments
            commands::payment::create_payment,
            commands::payment::list_payments,
            // Damaged Items
            commands::damaged::create_damaged_item,
            commands::damaged::list_damaged_items,
            // Production Orders
            commands::production::create_production_order,
            commands::production::list_production_orders,
            commands::production::get_production_order,
            // Stock Adjustments
            commands::adjustment::create_stock_adjustment,
            commands::adjustment::list_stock_adjustments,
            // Users & Roles
            commands::users::create_user,
            commands::users::list_users,
            commands::users::list_roles,
            commands::users::create_role,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            // Audit Log
            commands::audit::list_audit_logs,
        ])
        .setup(|app| {
            let app_state = tauri::async_runtime::block_on(
                bootstrap::container::build_app_state()
            ).expect("Failed to create app state");
            app.manage(app_state);
            Ok(())
        })
}
