use sqlx::SqlitePool;
use application::errors::AppError;
use application::dto::warehouse_dto::{WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest};
use domain::shared::ids::WarehouseId;
use super::models::WarehouseRow;
use super::mappers::row_to_dto;
use uuid::Uuid;

pub async fn create(pool: &SqlitePool, req: &CreateWarehouseRequest) -> Result<WarehouseDto, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM warehouses")
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let is_default = count.0 == 0;

    sqlx::query(
        "INSERT INTO warehouses (id, name, address, is_active, is_default, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&req.name)
    .bind(&req.address)
    .bind(is_default)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let row = sqlx::query_as::<_, WarehouseRow>(
        "SELECT id, name, address, is_active, is_default, created_at, updated_at FROM warehouses WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row_to_dto(row)
}

pub async fn update(pool: &SqlitePool, req: &UpdateWarehouseRequest) -> Result<WarehouseDto, AppError> {
    let now = chrono::Utc::now().to_rfc3339();

    if req.is_default {
        sqlx::query("UPDATE warehouses SET is_default = 0 WHERE id != ?")
            .bind(&req.id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }

    sqlx::query(
        "UPDATE warehouses SET name = ?, address = ?, is_active = ?, is_default = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&req.name)
    .bind(&req.address)
    .bind(req.is_active)
    .bind(req.is_default)
    .bind(&now)
    .bind(&req.id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let id: WarehouseId = req.id.parse().map_err(|e: uuid::Error| AppError::Invalid(e.to_string()))?;
    find_by_id_opt(pool, &id).await?.ok_or_else(|| AppError::NotFound("مستودع غير موجود".into()))
}

async fn find_by_id_opt(pool: &SqlitePool, id: &WarehouseId) -> Result<Option<WarehouseDto>, AppError> {
    let row = sqlx::query_as::<_, WarehouseRow>(
        "SELECT id, name, address, is_active, is_default, created_at, updated_at FROM warehouses WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_dto).transpose()
}

pub async fn delete(pool: &SqlitePool, id: &WarehouseId) -> Result<(), AppError> {
    let is_default: Option<(bool,)> = sqlx::query_as("SELECT is_default FROM warehouses WHERE id = ?")
        .bind(id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if is_default.map(|(d,)| d).unwrap_or(false) {
        return Err(AppError::Invalid("لا يمكن حذف المستودع الرئيسي".into()));
    }

    let has_movements: Option<(i32,)> = sqlx::query_as::<_, (i32,)>(
        "SELECT 1 FROM stock_movements WHERE warehouse_id = ? LIMIT 1"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if has_movements.is_some() {
        return Err(AppError::Invalid("لا يمكن حذف مستودع لديه حركات مخزنية".into()));
    }

    sqlx::query("DELETE FROM warehouses WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}
