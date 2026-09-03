use application::ports::account_repository::AccountRepository;
use application::ports::app_config_repository::AppConfigRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::audit_log_repository::AuditLogRepository;
use application::ports::category_repository::CategoryRepository;
use application::ports::code_prefix_repository::CodePrefixRepository;
use application::ports::consumable_repository::ConsumableRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::damaged_item_repository::DamagedItemRepository;
use application::ports::exchange_rate_repository::ExchangeRateRepository;
use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use application::ports::fiscal_year_repository::FiscalYearRepository;
use application::ports::inventory_lot_repository::InventoryLotRepository;
use application::ports::invoice_repository::InvoiceRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::opening_draft_repository::OpeningDraftRepository;
use application::ports::opening_item_repository::OpeningItemRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::payment_repository::PaymentRepository;
use application::ports::production_repository::ProductionRepository;
use application::ports::purchase_invoice_repository::PurchaseInvoiceRepository;
use application::ports::purchase_return_repository::PurchaseReturnRepository;
use application::ports::sales_return_repository::SalesReturnRepository;
use application::ports::search_provider::SearchProvider;
use application::ports::settings_repository::SettingsRepository;
use application::ports::stock_adjustment_repository::StockAdjustmentRepository;
use application::ports::stock_movement_repository::StockMovementRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use application::ports::user_repository::UserRepository;
use application::ports::warehouse_repository::WarehouseRepository;
use application::use_cases::currency::commands::CurrencyCommands;
use application::use_cases::currency::queries::CurrencyQueries;
use application::use_cases::currency::setup::CurrencySetupUseCase;
use application::use_cases::material::MaterialCodeUseCases;
use infrastructure::db::backup;
use infrastructure::repositories::SqliteFiscalPeriodRepository;
use infrastructure::repositories::SqliteFiscalYearRepository;
use infrastructure::repositories::SqliteInvoiceRepository;
use infrastructure::repositories::SqliteOpeningDraftRepository;
use infrastructure::repositories::SqliteOpeningItemRepository;
use infrastructure::repositories::SqliteOpeningMigrationRepository;
use infrastructure::repositories::SqliteOpeningPostingRepository;
use infrastructure::repositories::SqlitePurchaseInvoiceRepository;
use infrastructure::SqliteWarehouseRepository;
use infrastructure::{
    create_pool, run_migrations, SqliteAccountRepository, SqliteAccountSearchProvider,
    SqliteAppConfigRepository, SqliteAssetRepository, SqliteAuditLogRepository,
    SqliteCategoryRepository, SqliteCodePrefixRepository, SqliteConsumableRepository,
    SqliteCurrencyRepository, SqliteCustomerRepository, SqliteCustomerSearchProvider,
    SqliteDamagedItemRepository, SqliteExchangeRateRepository, SqliteInventoryLotRepository,
    SqliteJournalEntryRepository, SqliteMaterialRepository, SqliteMaterialSearchProvider,
    SqlitePartnerRepository, SqlitePartnerSearchProvider, SqlitePaymentRepository,
    SqliteProductionRepository, SqlitePurchaseReturnRepository, SqliteSalesReturnRepository,
    SqliteSettingsRepository, SqliteStockAdjustmentRepository, SqliteStockMovementRepository,
    SqliteSupplierRepository, SqliteSupplierSearchProvider, SqliteUnifiedInvoiceRepository,
    SqliteUserRepository,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: infrastructure::DbPool,
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
    pub prefix_repo: Arc<dyn CodePrefixRepository>,
    pub currency_repo: Arc<dyn CurrencyRepository>,
    pub exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    pub invoice_repo: Arc<dyn InvoiceRepository>,
    pub purchase_invoice_repo: Arc<dyn PurchaseInvoiceRepository>,
    pub sales_return_repo: Arc<dyn SalesReturnRepository>,
    pub purchase_return_repo: Arc<dyn PurchaseReturnRepository>,
    pub inventory_lot_repo: Arc<dyn InventoryLotRepository>,
    pub warehouse_repo: Arc<dyn WarehouseRepository>,
    pub opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    pub opening_posting_repo: Arc<dyn OpeningPostingRepository>,
    pub opening_item_repo: Arc<dyn OpeningItemRepository>,
    pub opening_draft_repo: Arc<dyn OpeningDraftRepository>,
    pub fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
    pub fiscal_year_repo: Arc<dyn FiscalYearRepository>,
    pub app_config_repo: Arc<dyn AppConfigRepository>,
    pub search_providers: Vec<Arc<dyn SearchProvider>>,
    pub material_code_use_cases: Arc<MaterialCodeUseCases>,
    pub currency_commands: Arc<CurrencyCommands>,
    pub currency_queries: Arc<CurrencyQueries>,
    pub currency_setup: Arc<CurrencySetupUseCase>,
}

pub async fn build_app_state(database_url: &str) -> Result<AppState, String> {
    let pool = create_pool(database_url)
        .await
        .map_err(|e: infrastructure::sqlx::Error| e.to_string())?;

    run_migrations(&pool)
        .await
        .map_err(|e: infrastructure::sqlx::migrate::MigrateError| {
            format!("Migration error: {}", e)
        })?;

    // Startup integrity check — report (not block) on a corrupt database so a
    // corrupted ledger is still discoverable via get_database_health.
    if let Err(e) = backup::quick_check(&pool).await {
        eprintln!("⚠️ Startup quick_check failed: {e}");
    }

    let material_repo = Arc::new(SqliteMaterialRepository::new(pool.clone()));
    let category_repo = Arc::new(SqliteCategoryRepository::new(pool.clone()));
    let stock_movement_repo = Arc::new(SqliteStockMovementRepository::new(pool.clone()));
    let customer_repo = Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let supplier_repo = Arc::new(SqliteSupplierRepository::new(pool.clone()));
    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let partner_repo = Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let unified_invoice_repo = Arc::new(SqliteUnifiedInvoiceRepository::new(pool.clone()));
    let prefix_repo = Arc::new(SqliteCodePrefixRepository::new(pool.clone()));
    let currency_repo = Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let exchange_rate_repo = Arc::new(SqliteExchangeRateRepository::new(pool.clone()));
    let invoice_repo = Arc::new(SqliteInvoiceRepository::new(pool.clone()));
    let purchase_invoice_repo = Arc::new(SqlitePurchaseInvoiceRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let sales_return_repo = Arc::new(SqliteSalesReturnRepository::new(pool.clone()));
    let purchase_return_repo = Arc::new(SqlitePurchaseReturnRepository::new(pool.clone()));
    let inventory_lot_repo = Arc::new(SqliteInventoryLotRepository::new(pool.clone()));
    let warehouse_repo = Arc::new(SqliteWarehouseRepository::new(pool.clone()));
    let app_config_repo = Arc::new(SqliteAppConfigRepository::new(pool.clone()));
    let search_providers: Vec<Arc<dyn SearchProvider>> = vec![
        Arc::new(SqliteAccountSearchProvider::new(
            account_repo.clone() as Arc<dyn AccountRepository>
        )),
        Arc::new(SqliteCustomerSearchProvider::new(
            customer_repo.clone() as Arc<dyn CustomerRepository>
        )),
        Arc::new(SqliteSupplierSearchProvider::new(
            supplier_repo.clone() as Arc<dyn SupplierRepository>
        )),
        Arc::new(SqlitePartnerSearchProvider::new(
            partner_repo.clone() as Arc<dyn PartnerRepository>
        )),
        Arc::new(SqliteMaterialSearchProvider::new(
            material_repo.clone() as Arc<dyn MaterialRepository>
        )),
    ];

    Ok(AppState {
        pool: pool.clone(),
        customer_repo: customer_repo.clone() as Arc<dyn CustomerRepository>,
        material_repo: material_repo.clone() as Arc<dyn MaterialRepository>,
        category_repo: category_repo.clone() as Arc<dyn CategoryRepository>,
        account_repo: account_repo.clone() as Arc<dyn AccountRepository>,
        journal_entry_repo: journal_repo.clone() as Arc<dyn JournalEntryRepository>,
        supplier_repo: supplier_repo.clone() as Arc<dyn SupplierRepository>,
        payment_repo: Arc::new(SqlitePaymentRepository::new(pool.clone()))
            as Arc<dyn PaymentRepository>,
        damaged_repo: Arc::new(SqliteDamagedItemRepository::new(pool.clone()))
            as Arc<dyn DamagedItemRepository>,
        adjustment_repo: Arc::new(SqliteStockAdjustmentRepository::new(pool.clone()))
            as Arc<dyn StockAdjustmentRepository>,
        settings_repo: settings_repo.clone() as Arc<dyn SettingsRepository>,
        audit_repo: Arc::new(SqliteAuditLogRepository::new(pool.clone()))
            as Arc<dyn AuditLogRepository>,
        user_repo: Arc::new(SqliteUserRepository::new(pool.clone())) as Arc<dyn UserRepository>,
        production_repo: Arc::new(SqliteProductionRepository::new(pool.clone()))
            as Arc<dyn ProductionRepository>,
        asset_repo: Arc::new(SqliteAssetRepository::new(pool.clone())) as Arc<dyn AssetRepository>,
        consumable_repo: Arc::new(SqliteConsumableRepository::new(pool.clone()))
            as Arc<dyn ConsumableRepository>,
        stock_movement_repo: stock_movement_repo.clone() as Arc<dyn StockMovementRepository>,
        unified_invoice_repo: unified_invoice_repo.clone() as Arc<dyn UnifiedInvoiceRepository>,
        partner_repo: partner_repo.clone() as Arc<dyn PartnerRepository>,
        prefix_repo: prefix_repo.clone() as Arc<dyn CodePrefixRepository>,
        currency_repo: currency_repo.clone() as Arc<dyn CurrencyRepository>,
        exchange_rate_repo: exchange_rate_repo.clone() as Arc<dyn ExchangeRateRepository>,
        invoice_repo: invoice_repo.clone() as Arc<dyn InvoiceRepository>,
        purchase_invoice_repo: purchase_invoice_repo.clone() as Arc<dyn PurchaseInvoiceRepository>,
        sales_return_repo: sales_return_repo.clone() as Arc<dyn SalesReturnRepository>,
        purchase_return_repo: purchase_return_repo.clone() as Arc<dyn PurchaseReturnRepository>,
        inventory_lot_repo: inventory_lot_repo.clone() as Arc<dyn InventoryLotRepository>,
        warehouse_repo: warehouse_repo.clone() as Arc<dyn WarehouseRepository>,
        opening_migration_repo: Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()))
            as Arc<dyn OpeningMigrationRepository>,
        opening_posting_repo: Arc::new(SqliteOpeningPostingRepository::new(pool.clone()))
            as Arc<dyn OpeningPostingRepository>,
        opening_item_repo: Arc::new(SqliteOpeningItemRepository::new(pool.clone()))
            as Arc<dyn OpeningItemRepository>,
        opening_draft_repo: Arc::new(SqliteOpeningDraftRepository::new(pool.clone()))
            as Arc<dyn OpeningDraftRepository>,
        fiscal_period_repo: Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()))
            as Arc<dyn FiscalPeriodRepository>,
        fiscal_year_repo: Arc::new(SqliteFiscalYearRepository::new(pool.clone()))
            as Arc<dyn FiscalYearRepository>,
        app_config_repo: app_config_repo.clone() as Arc<dyn AppConfigRepository>,
        search_providers,
        material_code_use_cases: Arc::new(MaterialCodeUseCases::new(
            prefix_repo.clone(),
            category_repo.clone(),
        )),
        currency_commands: Arc::new(CurrencyCommands::new(
            currency_repo.clone() as Arc<dyn CurrencyRepository>,
            exchange_rate_repo.clone() as Arc<dyn ExchangeRateRepository>,
        )),
        currency_queries: Arc::new(CurrencyQueries::new(
            currency_repo.clone() as Arc<dyn CurrencyRepository>,
            exchange_rate_repo.clone() as Arc<dyn ExchangeRateRepository>,
        )),
        currency_setup: Arc::new(CurrencySetupUseCase::new(
            currency_repo.clone() as Arc<dyn CurrencyRepository>,
            exchange_rate_repo.clone() as Arc<dyn ExchangeRateRepository>,
            settings_repo.clone() as Arc<dyn SettingsRepository>,
        )),
    })
}
