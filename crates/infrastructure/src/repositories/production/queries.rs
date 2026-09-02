use application::errors::AppError;
use domain::inventory::ProductionOrder;
use domain::shared::ids::ProductionOrderId;
use sqlx::SqlitePool;

pub async fn find_by_id(
    _pool: &SqlitePool,
    _id: &ProductionOrderId,
) -> Result<Option<ProductionOrder>, AppError> {
    Ok(None)
}

pub async fn list_all(_pool: &SqlitePool) -> Result<Vec<ProductionOrder>, AppError> {
    Ok(vec![])
}
