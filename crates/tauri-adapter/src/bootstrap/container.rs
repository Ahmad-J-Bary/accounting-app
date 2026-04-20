use std::sync::Arc;
use infrastructure::{
    SqliteInvoiceRepository,
    SqliteCustomerRepository,
    SqliteProductRepository,
    SqliteAccountRepository,
    SqliteJournalEntryRepository,
};
use infrastructure::db::pool::create_pool;
use application::ports::invoice_repository::InvoiceRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::product_repository::ProductRepository;
use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;

#[derive(Clone)]
pub struct AppState {
    pub invoice_repo: Arc<dyn InvoiceRepository>,
    pub customer_repo: Arc<dyn CustomerRepository>,
    pub product_repo: Arc<dyn ProductRepository>,
    pub account_repo: Arc<dyn AccountRepository>,
    pub journal_entry_repo: Arc<dyn JournalEntryRepository>,
}

pub async fn build_app_state() -> Result<AppState, String> {
    let database_url = "sqlite:./erp.db";
    let pool = create_pool(database_url).await.map_err(|e| e.to_string())?;

    Ok(AppState {
        invoice_repo: Arc::new(SqliteInvoiceRepository::new(pool.clone())),
        customer_repo: Arc::new(SqliteCustomerRepository::new(pool.clone())),
        product_repo: Arc::new(SqliteProductRepository::new(pool.clone())),
        account_repo: Arc::new(SqliteAccountRepository::new(pool.clone())),
        journal_entry_repo: Arc::new(SqliteJournalEntryRepository::new(pool)),
    })
}
