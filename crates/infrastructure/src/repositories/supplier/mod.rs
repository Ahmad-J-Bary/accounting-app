use application::errors::AppError;
use application::ports::supplier_repository::SupplierRepository;
use async_trait::async_trait;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::shared::ids::SupplierId;
use domain::shared::{AccountId, JournalEntryId};
use domain::suppliers::Supplier;
use sqlx::SqlitePool;
use std::sync::Arc;

mod commands;
mod mappers;
mod models;
mod queries;

pub struct SqliteSupplierRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteSupplierRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SupplierRepository for SqliteSupplierRepository {
    async fn save(&self, supplier: &Supplier) -> Result<(), AppError> {
        commands::save(&self.pool, supplier).await
    }

    async fn find_by_id(&self, id: &SupplierId) -> Result<Option<Supplier>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_account_id(
        &self,
        account_id: &AccountId,
    ) -> Result<Option<Supplier>, AppError> {
        queries::find_by_account_id(&self.pool, account_id).await
    }

    async fn find_by_name(&self, name: &str) -> Result<Vec<Supplier>, AppError> {
        queries::find_by_name(&self.pool, name).await
    }

    async fn list_all(&self) -> Result<Vec<Supplier>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn update(&self, supplier: &Supplier) -> Result<(), AppError> {
        commands::save(&self.pool, supplier).await
    }

    async fn delete(&self, id: &SupplierId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn get_next_supplier_number(&self) -> Result<i32, AppError> {
        queries::get_next_supplier_number(&self.pool).await
    }

    async fn save_with_accounting(
        &self,
        supplier: &Supplier,
        account: &Account,
        entries: &[JournalEntry],
    ) -> Result<(), AppError> {
        commands::save_with_accounting(&self.pool, supplier, account, entries).await
    }

    async fn update_with_accounting(
        &self,
        supplier: &Supplier,
        account: Option<&Account>,
        entries: &[JournalEntry],
    ) -> Result<(), AppError> {
        commands::update_with_accounting(&self.pool, supplier, account, entries).await
    }

    async fn delete_with_accounting(
        &self,
        id: &SupplierId,
        account_id: Option<&AccountId>,
        entry_ids: &[JournalEntryId],
    ) -> Result<(), AppError> {
        commands::delete_with_accounting(&self.pool, id, account_id, entry_ids).await
    }
}
