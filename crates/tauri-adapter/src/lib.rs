pub mod bootstrap;
pub mod commands;

use tauri::Manager;

pub fn run() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Invoices (Sales)
            commands::invoice::create_invoice,
            commands::invoice::list_invoices,
            commands::invoice::post_invoice,
            // Customers
            commands::customer::create_customer,
            commands::customer::get_customer,
            commands::customer::list_customers,
            commands::customer::update_customer,
            commands::customer::delete_customer,
            // Products
            commands::product::create_product,
            commands::product::get_product,
            commands::product::list_products,
            commands::product::update_product,
            commands::product::delete_product,
            commands::product::record_opening_stock,
            // Suppliers
            commands::supplier::create_supplier,
            commands::supplier::list_suppliers,
            commands::supplier::get_supplier,
            commands::supplier::update_supplier,
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
            // Inventory
            commands::inventory::list_stock_movements,
            // Journal Entries
            commands::journal::create_journal_entry,
            commands::journal::list_journal_entries,
            commands::journal::post_journal_entry,
            commands::journal::reverse_journal_entry,
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
            commands::accounting::get_chart_of_accounts,
            commands::accounting::get_account_ledger,
            commands::accounting::create_account,
            commands::accounting::update_account,
            commands::accounting::delete_account,
            commands::accounting::activate_account,
            commands::accounting::deactivate_account,
            commands::assets::create_fixed_asset,
            commands::assets::list_fixed_assets,
            commands::assets::create_consumable,
            commands::assets::list_consumables,
            commands::assets::create_asset_category,
            commands::assets::list_asset_categories,
            commands::assets::post_asset_depreciation,
            commands::assets::add_consumable_stock,
            commands::assets::issue_consumable,
            commands::assets::list_asset_movements,
            commands::assets::list_all_asset_movements,
        ])
        .setup(|app| {
            let app_state = tauri::async_runtime::block_on(bootstrap::container::build_app_state())
                .expect("Failed to create app state");
            app.manage(app_state);
            Ok(())
        })
}
