pub mod bootstrap;
pub mod commands;

use tauri::Manager;

pub fn run() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Unified Invoices
            commands::unified_invoice::create_unified_invoice,
            commands::unified_invoice::update_unified_invoice,
            commands::unified_invoice::list_unified_invoices_by_type,
            commands::unified_invoice::post_unified_invoice,
            commands::unified_invoice::get_unified_invoice_by_id,
            commands::unified_invoice::list_all_unified_invoices,
            commands::unified_invoice::reopen_unified_invoice,
            commands::unified_invoice::get_next_invoice_number,
            commands::unified_invoice::delete_unified_invoice,
            // Invoices (Legacy/Sales)
            commands::invoice::create_invoice,
            commands::invoice::list_invoices,
            commands::invoice::post_invoice,
            // Purchase Invoices (Legacy)
            commands::purchase::create_purchase_invoice,
            commands::purchase::list_purchase_invoices,
            commands::purchase::get_purchase_invoice,
            commands::purchase::post_purchase_invoice,
            // Customers
            commands::customer::create_customer,
            commands::customer::get_customer,
            commands::customer::list_customers,
            commands::customer::update_customer,
            commands::customer::delete_customer,
            // Materials & Categories
            commands::material::create_material,
            commands::material::get_material,
            commands::material::list_materials,
            commands::material::update_material,
            commands::material::delete_material,
            commands::material::add_material_unit,
            commands::material::delete_material_unit,
            commands::material::update_material_costing_method,
            commands::category::create_category,
            commands::category::list_categories,
            commands::category::update_category,
            commands::category::delete_category,
            commands::category::delete_category_with_reassignment,
            commands::category::get_or_create_hybrid_category,
            commands::material_code::generate_material_code,
            commands::material_code::preview_material_code,
            // Suppliers
            commands::supplier::create_supplier,
            commands::supplier::list_suppliers,
            commands::supplier::get_supplier,
            commands::supplier::update_supplier,
            commands::supplier::delete_supplier,
            // Payments
            commands::payment::create_payment,
            commands::payment::update_payment,
            commands::payment::list_payments,
            commands::payment::delete_payment,
            // Damaged Items
            commands::damaged::create_damaged_item,
            commands::damaged::list_damaged_items,
            commands::damaged::update_damaged_item,
            commands::damaged::delete_damaged_item,
            // Production Orders
            commands::production::create_production_order,
            commands::production::list_production_orders,
            commands::production::get_production_order,
            // Stock Adjustments
            commands::adjustment::create_stock_adjustment,
            commands::adjustment::list_stock_adjustments,
            // Inventory
            commands::inventory::list_stock_movements,
            commands::inventory::list_movements_by_material,
            commands::inventory::get_material_available_lots,
            commands::inventory::get_material_costing_method,
            // Journal Entries
            commands::journal::create_journal_entry,
            commands::journal::list_journal_entries,
            commands::journal::get_journal_entry_details,
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
            commands::accounting::get_expense_items,
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
            // Dashboard
            commands::dashboard::get_receivables_payables_summary,
            // Partners
            commands::partner::add_partner,
            commands::partner::list_partners,
            commands::partner::delete_partner,
            commands::partner::update_partner,
            // Currency
            commands::currency::list_currencies,
            commands::currency::list_active_currencies,
            commands::currency::create_currency,
            commands::currency::update_currency,
            commands::currency::set_base_currency,
            commands::currency::delete_currency,
            commands::currency::get_currency_context,
            commands::currency::get_today_rates_status,
            commands::currency::set_exchange_rate,
            commands::currency::list_rate_history,
            commands::currency::get_latest_exchange_rate,
            commands::currency::get_world_currencies,
            commands::currency::is_setup_complete,
            commands::currency::setup_currencies,
            // Update command
            commands::update::download_and_install_update,
            // Returns commands
            commands::returns::create_sales_return,
            commands::returns::list_sales_returns,
            commands::returns::get_sales_return,
            commands::returns::post_sales_return,
            commands::returns::create_purchase_return,
            commands::returns::list_purchase_returns,
            commands::returns::get_purchase_return,
            commands::returns::post_purchase_return,
            commands::returns::delete_sales_return,
            commands::returns::delete_purchase_return,
        ])
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data directory");
            if !app_data_dir.exists() {
                std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
            }
            let db_path = app_data_dir.join("erp.db");
            let database_url = format!("sqlite:{}?mode=rwc", db_path.display());

            let app_state = tauri::async_runtime::block_on(bootstrap::container::build_app_state(&database_url))
                .expect("Failed to create app state");
            app.manage(app_state);
            Ok(())
        })
}
