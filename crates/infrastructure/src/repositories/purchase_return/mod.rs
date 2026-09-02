use application::errors::AppError;
use application::ports::purchase_return_repository::PurchaseReturnRepository;
use async_trait::async_trait;
use domain::returns::PurchaseReturn;
use domain::shared::ids::PurchaseReturnId;
use sqlx::SqlitePool;
use std::sync::Arc;

mod commands;
mod mappers;
mod models;
mod queries;

pub struct SqlitePurchaseReturnRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePurchaseReturnRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PurchaseReturnRepository for SqlitePurchaseReturnRepository {
    async fn save(&self, ret: &PurchaseReturn) -> Result<(), AppError> {
        commands::save(&self.pool, ret).await
    }

    async fn find_by_id(&self, id: &PurchaseReturnId) -> Result<Option<PurchaseReturn>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<PurchaseReturn>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn delete(&self, id: &PurchaseReturnId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn get_next_return_number(&self) -> Result<String, AppError> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT return_number FROM purchase_returns ORDER BY created_at DESC LIMIT 1",
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        match row {
            Some((last,)) => {
                let num: u64 = last
                    .chars()
                    .skip_while(|c| !c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0);
                Ok((num + 1).to_string())
            }
            None => Ok("1".to_string()),
        }
    }

    async fn post_with_accounting(
        &self,
        movements: &[domain::inventory::stock_movement::StockMovement],
        entries: &[domain::accounting::journal_entry::JournalEntry],
        payment: Option<&domain::payments::Payment>,
        customers: &[domain::customers::Customer],
        suppliers: &[domain::suppliers::Supplier],
    ) -> Result<(), AppError> {
        crate::repositories::atomic::write_event(
            &self.pool,
            movements,
            entries,
            payment,
            customers,
            suppliers,
            &[],
        )
        .await
    }
}
