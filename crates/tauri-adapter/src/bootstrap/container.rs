use std::sync::Arc;
use infrastructure::{
    SqliteCustomerRepository,
    SqliteAccountRepository,
    SqliteJournalEntryRepository,
    SqliteSupplierRepository,
    SqlitePaymentRepository,
    SqliteDamagedItemRepository,
    SqliteStockAdjustmentRepository,
    SqliteSettingsRepository,
    SqliteAuditLogRepository,
    SqliteUserRepository,
    SqliteProductionRepository,
    SqliteAssetRepository,
    SqliteConsumableRepository,
    SqliteStockMovementRepository,
    SqliteUnitOfWork,
    SqlitePartnerRepository,
    SqliteMaterialRepository,
    SqliteCategoryRepository,
    SqliteUnifiedInvoiceRepository,
    SqliteCodePrefixRepository,
};
use application::use_cases::material_use_cases::MaterialUseCases;
use application::use_cases::category_use_cases::CategoryUseCases;
use application::use_cases::unified_invoice_use_cases::UnifiedInvoiceUseCases;
use application::use_cases::generate_material_code::MaterialCodeUseCases;
use infrastructure::db::pool::{create_pool, run_migrations};
use application::ports::customer_repository::CustomerRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::category_repository::CategoryRepository;
use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::ports::payment_repository::PaymentRepository;
use application::ports::damaged_item_repository::DamagedItemRepository;
use application::ports::stock_adjustment_repository::StockAdjustmentRepository;
use application::ports::settings_repository::SettingsRepository;
use application::ports::audit_log_repository::AuditLogRepository;
use application::ports::user_repository::UserRepository;
use application::ports::production_repository::ProductionRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::consumable_repository::ConsumableRepository;
use application::ports::stock_movement_repository::StockMovementRepository;
use application::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::unit_of_work::UnitOfWork;

#[derive(Clone)]
pub struct AppState {
    pub customer_repo: Arc<dyn CustomerRepository>,
    pub material_repo: Arc<dyn MaterialRepository>,
    pub category_repo: Arc<dyn CategoryRepository>,
    pub account_repo: Arc<dyn AccountRepository>,
    pub journal_entry_repo: Arc<dyn JournalEntryRepository>,
    pub supplier_repo: Arc<dyn SupplierRepository>,
    pub payment_repo: Arc<dyn PaymentRepository>,
    pub damaged_repo: Arc<dyn DamagedItemRepository>,
    pub adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    pub settings_repo: Arc<dyn SettingsRepository>,
    pub audit_repo: Arc<dyn AuditLogRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub production_repo: Arc<dyn ProductionRepository>,
    pub asset_repo: Arc<dyn AssetRepository>,
    pub consumable_repo: Arc<dyn ConsumableRepository>,
    pub stock_movement_repo: Arc<dyn StockMovementRepository>,
    pub unified_invoice_repo: Arc<dyn UnifiedInvoiceRepository>,
    pub partner_repo: Arc<dyn PartnerRepository>,
    pub uow: Arc<dyn UnitOfWork>,
    pub material_use_cases: Arc<MaterialUseCases>,
    pub category_use_cases: Arc<CategoryUseCases>,
    pub unified_invoice_use_cases: Arc<UnifiedInvoiceUseCases>,
    pub material_code_use_cases: Arc<MaterialCodeUseCases>,
}

pub async fn build_app_state(database_url: &str) -> Result<AppState, String> {
    let pool = create_pool(database_url).await.map_err(|e| e.to_string())?;
    
    run_migrations(&pool).await.map_err(|e| format!("Migration error: {}", e))?;
 
    let material_repo = Arc::new(SqliteMaterialRepository::new(pool.clone()));
    let category_repo = Arc::new(SqliteCategoryRepository::new(pool.clone()));
    let stock_movement_repo = Arc::new(SqliteStockMovementRepository::new(pool.clone()));
    let customer_repo = Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let supplier_repo = Arc::new(SqliteSupplierRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let unified_invoice_repo = Arc::new(SqliteUnifiedInvoiceRepository::new(pool.clone()));

    Ok(AppState {
        customer_repo: customer_repo.clone() as Arc<dyn CustomerRepository>,
        material_repo: material_repo.clone() as Arc<dyn MaterialRepository>,
        category_repo: category_repo.clone() as Arc<dyn CategoryRepository>,
        account_repo: Arc::new(SqliteAccountRepository::new(pool.clone())) as Arc<dyn AccountRepository>,
        journal_entry_repo: journal_repo.clone() as Arc<dyn JournalEntryRepository>,
        supplier_repo: supplier_repo.clone() as Arc<dyn SupplierRepository>,
        payment_repo: Arc::new(SqlitePaymentRepository::new(pool.clone())) as Arc<dyn PaymentRepository>,
        damaged_repo: Arc::new(SqliteDamagedItemRepository::new(pool.clone())) as Arc<dyn DamagedItemRepository>,
        adjustment_repo: Arc::new(SqliteStockAdjustmentRepository::new(pool.clone())) as Arc<dyn StockAdjustmentRepository>,
        settings_repo: Arc::new(SqliteSettingsRepository::new(pool.clone())) as Arc<dyn SettingsRepository>,
        audit_repo: Arc::new(SqliteAuditLogRepository::new(pool.clone())) as Arc<dyn AuditLogRepository>,
        user_repo: Arc::new(SqliteUserRepository::new(pool.clone())) as Arc<dyn UserRepository>,
        production_repo: Arc::new(SqliteProductionRepository::new(pool.clone())) as Arc<dyn ProductionRepository>,
        asset_repo: Arc::new(SqliteAssetRepository::new(pool.clone())) as Arc<dyn AssetRepository>,
        consumable_repo: Arc::new(SqliteConsumableRepository::new(pool.clone())) as Arc<dyn ConsumableRepository>,
        stock_movement_repo: stock_movement_repo.clone() as Arc<dyn StockMovementRepository>,
        unified_invoice_repo: unified_invoice_repo.clone() as Arc<dyn UnifiedInvoiceRepository>,
        partner_repo: Arc::new(SqlitePartnerRepository::new(pool.clone())) as Arc<dyn PartnerRepository>,
        uow: Arc::new(SqliteUnitOfWork::new(pool.clone())) as Arc<dyn UnitOfWork>,
        material_use_cases: Arc::new(MaterialUseCases::new(
            material_repo.clone(),
            stock_movement_repo.clone(),
            category_repo.clone(),
        )),
        category_use_cases: Arc::new(CategoryUseCases::new(category_repo.clone())),
        material_code_use_cases: Arc::new(MaterialCodeUseCases::new(
            Arc::new(SqliteCodePrefixRepository::new(pool.clone())),
            category_repo.clone(),
        )),
        unified_invoice_use_cases: Arc::new(UnifiedInvoiceUseCases::new(
            unified_invoice_repo.clone(),
            material_repo.clone(),
            stock_movement_repo.clone(),
            customer_repo.clone(),
            supplier_repo.clone(),
            category_repo.clone(),
            journal_repo.clone(),
        )),
    })
}
