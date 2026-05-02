use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::stock_movement::{StockMovement};
use domain::shared::ids::{StockMovementId, MaterialId};
use rust_decimal::Decimal;
use super::models::StockMovementRow;
use super::mappers::row_to_movement;

pub async fn find_by_id(pool: &SqlitePool, id: &StockMovementId) -> Result<Option<StockMovement>, AppError> {
    let row = sqlx::query_as::<_, StockMovementRow>(
        "SELECT id, material_id, quantity, unit_cost, total_cost, movement_type, reason, reference, movement_date, created_at FROM stock_movements WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_movement).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<StockMovement>, AppError> {
    let rows = sqlx::query_as::<_, StockMovementRow>("SELECT id, material_id, quantity, unit_cost, total_cost, movement_type, reason, reference, movement_date, created_at FROM stock_movements ORDER BY movement_date DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_movement).collect()
}

pub async fn list_by_material(pool: &SqlitePool, material_id: &MaterialId) -> Result<Vec<StockMovement>, AppError> {
    let rows = sqlx::query_as::<_, StockMovementRow>(
        "SELECT id, material_id, quantity, unit_cost, total_cost, movement_type, reason, reference, movement_date, created_at FROM stock_movements WHERE material_id = ? ORDER BY movement_date DESC"
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

pub async fn get_material_summary(pool: &SqlitePool, material_id: &MaterialId) -> Result<application::ports::stock_movement_repository::MaterialInventorySummary, AppError> {
    let movements = list_by_material(pool, material_id).await?;
    
    let mut total_received = Decimal::ZERO;
    let mut total_sold = Decimal::ZERO;
    let mut total_damaged = Decimal::ZERO;
    let mut total_available = Decimal::ZERO;
    let mut total_inflow_cost = Decimal::ZERO;
    
    let mut last_purchase_price = Decimal::ZERO;
    let mut last_sale_price = Decimal::ZERO;

    // movements are ordered by date DESC
    let mut found_last_purchase = false;
    let mut found_last_sale = false;

    for m in &movements {
        if m.is_inflow() {
            total_available += m.quantity;
            total_received += m.quantity;
            total_inflow_cost += m.total_cost;
            
            if !found_last_purchase && (matches!(m.movement_type, domain::inventory::stock_movement::MovementType::Purchase) || matches!(m.movement_type, domain::inventory::stock_movement::MovementType::In)) {
                last_purchase_price = m.unit_cost;
                found_last_purchase = true;
            }
        } else if m.is_outflow() {
            total_available -= m.quantity;
            
            if matches!(m.movement_type, domain::inventory::stock_movement::MovementType::Sale) {
                total_sold += m.quantity;
                if !found_last_sale {
                    last_sale_price = m.unit_cost;
                    found_last_sale = true;
                }
            } else if matches!(m.movement_type, domain::inventory::stock_movement::MovementType::Damaged) {
                total_damaged += m.quantity;
            }
        }
    }

    let average_cost = if total_received > Decimal::ZERO {
        total_inflow_cost / total_received
    } else {
        Decimal::ZERO
    };

    Ok(application::ports::stock_movement_repository::MaterialInventorySummary {
        total_received,
        total_sold,
        total_available,
        total_damaged,
        last_purchase_price,
        last_sale_price,
        average_cost,
    })
}
