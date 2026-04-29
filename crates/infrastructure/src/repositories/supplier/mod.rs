use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::supplier_repository::SupplierRepository;
use domain::suppliers::Supplier;
use domain::shared::ids::SupplierId;
use domain::shared::AccountId;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

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

    async fn find_by_account_id(&self, account_id: &AccountId) -> Result<Option<Supplier>, AppError> {
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
}
