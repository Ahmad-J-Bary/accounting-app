use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::stock_movement::{StockMovement};
use domain::shared::ids::{StockMovementId, MaterialId};
use rust_decimal::Decimal;
use super::models::StockMovementRow;
use super::mappers::row_to_movement;

pub async fn find_by_id(pool: &SqlitePool, id: &StockMovementId) -> Result<Option<StockMovement>, AppError> {
    let row = sqlx::query_as::<_, StockMovementRow>(
        "SELECT id, material_id, quantity, movement_type, reason, reference, movement_date, created_at FROM stock_movements WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_movement).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<StockMovement>, AppError> {
    let rows = sqlx::query_as::<_, StockMovementRow>("SELECT * FROM stock_movements ORDER BY movement_date DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_movement).collect()
}

pub async fn list_by_material(pool: &SqlitePool, material_id: &MaterialId) -> Result<Vec<StockMovement>, AppError> {
    let rows = sqlx::query_as::<_, StockMovementRow>(
        "SELECT * FROM stock_movements WHERE material_id = ? ORDER BY movement_date DESC"
    )
    .bind(material_id.to_string())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_movement).collect()
}

pub async fn get_stock_balance(pool: &SqlitePool, material_id: &MaterialId) -> Result<Decimal, AppError> {
    let movements = list_by_material(pool, material_id).await?;
    let mut balance = Decimal::ZERO;
    for m in movements {
        if m.is_inflow() {
            balance += m.quantity;
        } else if m.is_outflow() {
            balance -= m.quantity;
        }
    }
    Ok(balance)
}
