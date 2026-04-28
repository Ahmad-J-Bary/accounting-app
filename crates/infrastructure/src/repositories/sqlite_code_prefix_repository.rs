use std::sync::Arc;
use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::code_prefix_repository::CodePrefixRepository;

pub struct SqliteCodePrefixRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCodePrefixRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CodePrefixRepository for SqliteCodePrefixRepository {
    async fn get_next_sequence(&self, category_id: &str) -> Result<u64, AppError> {
        // Begin transaction
        let mut tx = self.pool.begin().await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        // Try to update existing
        let rows_affected = sqlx::query(
            "UPDATE category_code_prefixes SET next_seq = next_seq + 1, updated_at = datetime('now') WHERE category_id = ?"
        )
        .bind(category_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?
        .rows_affected();

        let seq: i64;

        if rows_affected == 0 {
            // Check if the category even exists and has a prefix
            let prefix_row: Option<(String,)> = sqlx::query_as(
                "SELECT code_prefix FROM categories WHERE id = ? AND code_prefix IS NOT NULL"
            )
            .bind(category_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            let prefix = prefix_row
                .map(|r| r.0)
                .ok_or_else(|| AppError::Invalid("لا يملك هذا التصنيف بادئة كود".into()))?;

            // Insert new sequence starting at 1 (we return 0 below for the first item, but we increment here to 1)
            let id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO category_code_prefixes (id, category_id, prefix, next_seq, created_at, updated_at)
                 VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))"
            )
            .bind(&id)
            .bind(category_id)
            .bind(&prefix)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            seq = 0; // The returned sequence is 0 for the first item
        } else {
            // Fetch the newly updated sequence
            let row: (i64,) = sqlx::query_as(
                "SELECT next_seq - 1 FROM category_code_prefixes WHERE category_id = ?"
            )
            .bind(category_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            seq = row.0;
        }

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(seq as u64)
    }
}
