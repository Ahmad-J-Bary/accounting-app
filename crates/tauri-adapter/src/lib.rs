pub mod bootstrap;
pub mod commands;

use std::path::PathBuf;
use tauri::{Emitter, Manager};

use crate::bootstrap::container::AppState;

/// Apply a staged restore at startup, BEFORE the connection pool opens.
///
/// A restore staged by `import_database`/`import_database_from_bytes` lives at
/// `<data_dir>/erp.pending.sqlite` plus a `restore.pending.json` marker. Since
/// the previous launch closed the pool (process exit), swapping files here is
/// safe on every platform and the natural startup path then runs migrations and
/// integrity checks against the restored file.
fn apply_pending_restore(data_dir: &std::path::Path, db_path: &std::path::Path) {
    let Ok(Some(pending)) = infrastructure::db::backup::take_pending_marker(data_dir) else {
        return;
    };
    let pending_path = PathBuf::from(&pending.pending_db);
    if !pending_path.exists() {
        eprintln!("⚠️ Pending restore file missing: {}", pending.pending_db);
        return;
    }
    eprintln!("♻️ Applying pending restore from {}", pending.pending_db);
    if let Err(e) = infrastructure::db::backup::replace_db_file(db_path, &pending_path) {
        eprintln!("⚠️ Failed to apply pending restore: {e}");
    }
    let _ = std::fs::remove_file(&pending_path);
}

/// Create an automatic backup on startup (if enabled and due), then trim old
/// backups per the configured retention policy.
async fn run_startup_backup(app: tauri::AppHandle, state: AppState) {
    use infrastructure::db::backup as b;
    let pool = state.pool;
    let is_enabled = b::get_config(&pool, "backup_auto_enabled")
        .await
        .map(|v| v.map(|s| s == "true").unwrap_or(true))
        .unwrap_or(true);
    if !is_enabled {
        return;
    }

    let Ok(data_dir) = app.path().app_data_dir() else {
        return;
    };
    let db_path = data_dir.join("erp.db");
    let use_same_location = b::get_config(&pool, "backup_use_same_location")
        .await
        .map(|v| v.map(|s| s == "true").unwrap_or(true))
        .unwrap_or(true);
    let custom_path = b::get_config(&pool, "backup_custom_path").await.unwrap_or(None);
    let backup_dir = b::resolve_backup_dir(&db_path, use_same_location, custom_path.as_deref());

    let last_auto = b::get_config(&pool, "backup_last_auto").await.unwrap_or(None);
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    if last_auto.as_deref() == Some(&today) {
        return;
    }

    if std::fs::create_dir_all(&backup_dir).is_err() {
        return;
    }
    let filename = b::backup_filename(b::BACKUP_PREFIX);
    let dest = backup_dir.join(&filename);
    if let Err(e) = b::create_snapshot(&pool, &dest).await {
        eprintln!("⚠️ Startup auto-backup failed: {e}");
        return;
    }
    let _ = b::set_config(&pool, "backup_last_auto", &today).await;

    let retention = b::get_config(&pool, "backup_retention_days")
        .await
        .ok()
        .flatten()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(30);
    if let Err(e) = b::cleanup_old_backups(&backup_dir, retention) {
        eprintln!("⚠️ Backup cleanup failed: {e}");
    }
    let _ = app.emit("backup-created", filename);
}

pub fn run() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::adjustment::get_stock_adjustment,
            commands::adjustment::update_stock_adjustment,
            commands::adjustment::delete_stock_adjustment,
            // Inventory
            commands::inventory::list_stock_movements,
            commands::inventory::list_movements_by_material,
            commands::inventory::get_material_available_lots,
            commands::inventory::get_stock_balance,
            commands::inventory::get_material_costing_method,
            commands::inventory::get_material_lots,
            commands::inventory::update_lot_sale_prices,
            commands::inventory::get_material_purchase_price_history,
            // Journal Entries
            commands::journal::create_journal_entry,
            commands::journal::list_journal_entries,
            commands::journal::list_posted_journal_entries,
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
            commands::assets::update_fixed_asset,
            commands::assets::delete_fixed_asset,
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
            commands::assets::run_yearly_rotation,
            // Dashboard
            commands::dashboard::get_receivables_payables_summary,
            // Partners
            commands::partner::add_partner,
            commands::partner::create_capital_contribution,
            commands::partner::create_partner_drawing,
            commands::partner::capitalize_retained_earnings,
            commands::partner::list_partners,
            commands::partner::get_partner_equity_statement,
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
            // Update commands
            commands::update::download_and_install_update,
            commands::update::download_and_prepare_update,
            commands::update::apply_update_and_restart,
            commands::update::compute_sha256_command,
            commands::update::get_file_size,
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
            commands::returns::get_next_sales_return_number,
            commands::returns::get_next_purchase_return_number,
            // Warehouse commands
            commands::warehouse::create_warehouse,
            commands::warehouse::list_warehouses,
            commands::warehouse::get_warehouse,
            commands::warehouse::update_warehouse,
            commands::warehouse::delete_warehouse,
            commands::warehouse::get_default_warehouse,
            // Transfer commands
            commands::transfer::create_transfer,
            commands::transfer::delete_transfer,
            commands::transfer::update_transfer,
            commands::settle::settle_partner_balance,
            // Export commands
            commands::export::save_file,
            // Backup / restore commands
            commands::backup::backup_database_now,
            commands::backup::list_backups,
            commands::backup::get_backup_config,
            commands::backup::set_backup_config,
            commands::backup::export_database,
            commands::backup::export_database_to_bytes,
            commands::backup::import_database,
            commands::backup::import_database_from_bytes,
            commands::backup::pending_restore_status,
            commands::backup::cancel_pending_restore,
            commands::backup::delete_backup_file,
            commands::backup::request_app_restart,
            commands::backup::get_database_health,
            // Opening balance migration
            commands::opening_balance::create_opening_balance_migration,
            commands::opening_balance::update_opening_balance_migration_lines,
            commands::opening_balance::list_opening_balance_migrations,
            commands::opening_balance::post_opening_balance_migration,
            commands::opening_balance::allocate_net_profit,
            commands::opening_balance::preview_profit_distribution,
            commands::opening_balance::compute_opening_balance_net_profit,
            commands::opening_balance::cancel_opening_balance_migration,
            commands::opening_balance::reopen_opening_balance_migration,
            commands::opening_balance::validate_opening_balance_migration,
            commands::opening_balance::approve_opening_balance_migration,
            commands::opening_balance::lock_opening_balance_migration,
            commands::opening_balance::save_opening_balance_items,
            commands::opening_balance::get_opening_balance_reconciliation,
            commands::opening_balance::set_opening_balance_residual_classification,
            commands::opening_balance::apply_opening_balance_residual_classification,
            commands::opening_balance::get_opening_balance_residual_classification_spec,
            commands::opening_balance::get_opening_position_control,
            commands::opening_balance::get_opening_wizard_draft,
            commands::opening_balance::save_opening_wizard_draft,
            commands::opening_balance::clear_opening_wizard_draft,
            commands::fiscal_period::create_fiscal_period,
            commands::fiscal_period::list_fiscal_periods,
            commands::fiscal_period::close_fiscal_period,
            commands::fiscal_period::lock_fiscal_period,
            commands::fiscal_period::reopen_fiscal_period,
            commands::fiscal_period::compute_period_net_profit,
            commands::fiscal_period::get_distributable_profit,
        ])
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            if !app_data_dir.exists() {
                std::fs::create_dir_all(&app_data_dir)
                    .expect("Failed to create app data directory");
            }
            let db_path = app_data_dir.join("erp.db");

            // Apply any staged restore BEFORE the pool opens (file swap is only
            // safe while no connection exists). Migrations + integrity checks
            // then run against the restored file via the normal startup path.
            apply_pending_restore(&app_data_dir, &db_path);

            let database_url = format!("sqlite:{}?mode=rwc", db_path.display());

            let app_state = tauri::async_runtime::block_on(bootstrap::container::build_app_state(
                &database_url,
            ))
            .expect("Failed to create app state");
            app.manage(app_state.clone());

            // Start the daily auto-backup in the background (best effort).
            let backup_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                run_startup_backup(backup_handle, app_state).await;
            });

            Ok(())
        })
}
