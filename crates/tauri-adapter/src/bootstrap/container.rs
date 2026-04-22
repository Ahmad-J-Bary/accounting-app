use std::sync::Arc;
use infrastructure::{
    SqliteInvoiceRepository,
    SqliteCustomerRepository,
    SqliteProductRepository,
    SqliteAccountRepository,
    SqliteJournalEntryRepository,
    SqliteSupplierRepository,
    SqlitePurchaseInvoiceRepository,
    SqlitePaymentRepository,
    SqliteDamagedItemRepository,
    SqliteStockAdjustmentRepository,
    SqliteSettingsRepository,
    SqliteAuditLogRepository,
    SqliteUserRepository,
    SqliteProductionRepository,
    SqliteAssetRepository,
    SqliteConsumableRepository,
};
use infrastructure::db::pool::{create_pool, run_migrations};
use application::ports::invoice_repository::InvoiceRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::product_repository::ProductRepository;
use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::ports::purchase_invoice_repository::PurchaseInvoiceRepository;
use application::ports::payment_repository::PaymentRepository;
use application::ports::damaged_item_repository::DamagedItemRepository;
use application::ports::stock_adjustment_repository::StockAdjustmentRepository;
use application::ports::settings_repository::SettingsRepository;
use application::ports::audit_log_repository::AuditLogRepository;
use application::ports::user_repository::UserRepository;
use application::ports::production_repository::ProductionRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::consumable_repository::ConsumableRepository;

#[derive(Clone)]
pub struct AppState {
    pub invoice_repo: Arc<dyn InvoiceRepository>,
    pub customer_repo: Arc<dyn CustomerRepository>,
    pub product_repo: Arc<dyn ProductRepository>,
    pub account_repo: Arc<dyn AccountRepository>,
    pub journal_entry_repo: Arc<dyn JournalEntryRepository>,
    pub supplier_repo: Arc<dyn SupplierRepository>,
    pub purchase_invoice_repo: Arc<dyn PurchaseInvoiceRepository>,
    pub payment_repo: Arc<dyn PaymentRepository>,
    pub damaged_repo: Arc<dyn DamagedItemRepository>,
    pub adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    pub settings_repo: Arc<dyn SettingsRepository>,
    pub audit_repo: Arc<dyn AuditLogRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub production_repo: Arc<dyn ProductionRepository>,
    pub asset_repo: Arc<dyn AssetRepository>,
    pub consumable_repo: Arc<dyn ConsumableRepository>,
}

pub async fn build_app_state() -> Result<AppState, String> {
    let database_url = if std::path::Path::new("erp.db").exists() {
        "sqlite:erp.db?mode=rwc"
    } else if std::path::Path::new("../../../erp.db").exists() {
        "sqlite:../../../erp.db?mode=rwc"
    } else {
        "sqlite:erp.db?mode=rwc"
    };
    let pool = create_pool(database_url).await.map_err(|e| e.to_string())?;
    
    // Run migrations to ensure all tables exist
    run_migrations(&pool).await.map_err(|e| format!("Migration error: {}", e))?;

    Ok(AppState {
        invoice_repo: Arc::new(SqliteInvoiceRepository::new(pool.clone())),
        customer_repo: Arc::new(SqliteCustomerRepository::new(pool.clone())),
        product_repo: Arc::new(SqliteProductRepository::new(pool.clone())),
        account_repo: Arc::new(SqliteAccountRepository::new(pool.clone())),
        journal_entry_repo: Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        supplier_repo: Arc::new(SqliteSupplierRepository::new(pool.clone())),
        purchase_invoice_repo: Arc::new(SqlitePurchaseInvoiceRepository::new(pool.clone())),
        payment_repo: Arc::new(SqlitePaymentRepository::new(pool.clone())),
        damaged_repo: Arc::new(SqliteDamagedItemRepository::new(pool.clone())),
        adjustment_repo: Arc::new(SqliteStockAdjustmentRepository::new(pool.clone())),
        settings_repo: Arc::new(SqliteSettingsRepository::new(pool.clone())),
        audit_repo: Arc::new(SqliteAuditLogRepository::new(pool.clone())),
        user_repo: Arc::new(SqliteUserRepository::new(pool.clone())),
        production_repo: Arc::new(SqliteProductionRepository::new(pool.clone())),
        asset_repo: Arc::new(SqliteAssetRepository::new(pool.clone())),
        consumable_repo: Arc::new(SqliteConsumableRepository::new(pool)),
    })
}
