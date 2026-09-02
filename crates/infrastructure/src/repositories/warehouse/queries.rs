use super::mappers::row_to_dto;
use super::models::WarehouseRow;
use application::dto::warehouse_dto::WarehouseDto;
use application::errors::AppError;
use domain::shared::ids::WarehouseId;
use sqlx::SqlitePool;

pub async fn find_by_id(
    pool: &SqlitePool,
    id: &WarehouseId,
) -> Result<Option<WarehouseDto>, AppError> {
    let row = sqlx::query_as::<_, WarehouseRow>(
        "SELECT id, name, address, is_active, is_default, created_at, updated_at FROM warehouses WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_dto).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<WarehouseDto>, AppError> {
    let rows = sqlx::query_as::<_, WarehouseRow>(
        "SELECT id, name, address, is_active, is_default, created_at, updated_at FROM warehouses ORDER BY created_at ASC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_dto).collect()
}

pub async fn get_default(pool: &SqlitePool) -> Result<Option<WarehouseDto>, AppError> {
    let row = sqlx::query_as::<_, WarehouseRow>(
        "SELECT id, name, address, is_active, is_default, created_at, updated_at FROM warehouses WHERE is_default = 1 LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_dto).transpose()
}
