use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::ProductionOrder;
use domain::shared::ids::ProductionOrderId;

pub async fn save(_pool: &SqlitePool, _order: &ProductionOrder) -> Result<(), AppError> {
    Ok(())
}

pub async fn update(_pool: &SqlitePool, _order: &ProductionOrder) -> Result<(), AppError> {
    Ok(())
}

pub async fn delete(_pool: &SqlitePool, _id: &ProductionOrderId) -> Result<(), AppError> {
    Ok(())
}
