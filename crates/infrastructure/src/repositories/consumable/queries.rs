use super::mappers::row_to_consumable;
use super::models::ConsumableRow;
use application::errors::AppError;
use domain::assets::{Consumable, ConsumableId};
use sqlx::SqlitePool;

pub async fn find_by_id(
    pool: &SqlitePool,
    id: &ConsumableId,
) -> Result<Option<Consumable>, AppError> {
    let row = sqlx::query_as::<_, ConsumableRow>("SELECT * FROM consumables WHERE id = ?")
        .bind(id.0.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_consumable).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Consumable>, AppError> {
    let rows = sqlx::query_as::<_, ConsumableRow>("SELECT * FROM consumables ORDER BY code ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_consumable).collect()
}
