use std::sync::Arc;
use core_infrastructure::repositories::{
    SqliteInvoiceRepository,
    SqliteCustomerRepository,
    SqliteProductRepository,
    SqliteAccountRepository,
    SqliteJournalEntryRepository,
};
use core_infrastructure::db::pool::create_pool;
use core_application::ports::{
    InvoiceRepository,
    CustomerRepository,
    ProductRepository,
    AccountRepository,
    JournalEntryRepository,
};

#[derive(Clone)]
pub struct AppState {
    pub invoice_repo: Arc<dyn InvoiceRepository>,
    pub customer_repo: Arc<dyn CustomerRepository>,
    pub product_repo: Arc<dyn ProductRepository>,
    pub account_repo: Arc<dyn AccountRepository>,
    pub journal_entry_repo: Arc<dyn JournalEntryRepository>,
}

pub async fn build_app_state() -> AppState {
    let database_url = "sqlite:./erp.db";
    let pool = create_pool(database_url).await.expect("Failed to create database pool");

    AppState {
        invoice_repo: Arc::new(SqliteInvoiceRepository::new(pool.clone())),
        customer_repo: Arc::new(SqliteCustomerRepository::new(pool.clone())),
        product_repo: Arc::new(SqliteProductRepository::new(pool.clone())),
        account_repo: Arc::new(SqliteAccountRepository::new(pool.clone())),
        journal_entry_repo: Arc::new(SqliteJournalEntryRepository::new(pool)),
    }
}
