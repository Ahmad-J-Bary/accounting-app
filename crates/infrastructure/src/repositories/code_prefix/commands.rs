use application::errors::AppError;
use sqlx::SqlitePool;

pub async fn get_next_sequence(pool: &SqlitePool, category_id: &str) -> Result<u64, AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let rows_affected = sqlx::query(
        "UPDATE category_code_prefixes SET next_seq = next_seq + 1, updated_at = datetime('now') WHERE category_id = ?"
    )
    .bind(category_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?
    .rows_affected();

    let seq: i64 = if rows_affected == 0 {
        let prefix_row: Option<(String,)> = sqlx::query_as(
            "SELECT code_prefix FROM categories WHERE id = ? AND code_prefix IS NOT NULL",
        )
        .bind(category_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let prefix = prefix_row.map(|r| r.0).unwrap_or_else(|| "غ".to_string());

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

        0
    } else {
        let row: (i64,) =
            sqlx::query_as("SELECT next_seq - 1 FROM category_code_prefixes WHERE category_id = ?")
                .bind(category_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.0
    };

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(seq as u64)
}

pub async fn preview_next_sequence(pool: &SqlitePool, category_id: &str) -> Result<u64, AppError> {
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT next_seq FROM category_code_prefixes WHERE category_id = ?")
            .bind(category_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(row.map(|r| r.0 as u64).unwrap_or(0))
}
