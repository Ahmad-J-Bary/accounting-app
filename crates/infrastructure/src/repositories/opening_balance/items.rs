use std::sync::Arc;
use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::opening_item_repository::OpeningItemRepository;
use application::use_cases::opening_balance::types::OpeningItemInput;

pub struct SqliteOpeningItemRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteOpeningItemRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl OpeningItemRepository for SqliteOpeningItemRepository {
    async fn replace_items(&self, migration_id: &str, items: &[OpeningItemInput]) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query("DELETE FROM opening_migration_items WHERE migration_id = ?")
            .bind(migration_id).execute(&mut *tx).await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for it in items {
            sqlx::query(
                "INSERT INTO opening_migration_items (id, migration_id, kind, entity_id, reference, amount, qty, created_at) VALUES (?,?,?,?,?,?,?,?)"
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(migration_id).bind(&it.kind).bind(&it.entity_id)
            .bind(&it.reference).bind(&it.amount).bind(&it.qty)
            .bind(chrono::Utc::now().to_rfc3339())
            .execute(&mut *tx).await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))
    }

    async fn load_items(&self, migration_id: &str) -> Result<Vec<OpeningItemInput>, AppError> {
        #[derive(sqlx::FromRow)]
        struct Row {
            kind: String,
            entity_id: String,
            reference: Option<String>,
            amount: String,
            qty: String,
        }

        let rows: Vec<Row> = sqlx::query_as::<_, Row>(
            "SELECT kind, entity_id, reference, amount, qty FROM opening_migration_items WHERE migration_id = ?"
        )
        .bind(migration_id).fetch_all(&*self.pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(|r| OpeningItemInput {
            kind: r.kind,
            entity_id: r.entity_id,
            reference: r.reference,
            amount: r.amount,
            qty: r.qty,
        }).collect())
    }
}
