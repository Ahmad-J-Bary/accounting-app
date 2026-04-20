use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::stock_adjustment_repository::StockAdjustmentRepository;
use domain::inventory::StockAdjustment;
use domain::shared::ids::{StockAdjustmentId, ProductId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

pub struct SqliteStockAdjustmentRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteStockAdjustmentRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct AdjustmentRow {
    id: String,
    product_id: String,
    system_quantity: String,
    actual_quantity: String,
    difference: String,
    reason: Option<String>,
    adjustment_date: String,
    created_at: String,
}

fn row_to_adjustment(row: AdjustmentRow) -> Result<StockAdjustment, AppError> {
    Ok(StockAdjustment {
        id: StockAdjustmentId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        product_id: ProductId(Uuid::parse_str(&row.product_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        system_quantity: Decimal::from_str(&row.system_quantity).unwrap_or(Decimal::ZERO),
        actual_quantity: Decimal::from_str(&row.actual_quantity).unwrap_or(Decimal::ZERO),
        difference: Decimal::from_str(&row.difference).unwrap_or(Decimal::ZERO),
        reason: row.reason,
        adjustment_date: DateTime::parse_from_rfc3339(&row.adjustment_date).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl StockAdjustmentRepository for SqliteStockAdjustmentRepository {
    async fn save(&self, adj: &StockAdjustment) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO stock_adjustments (id, product_id, system_quantity, actual_quantity, difference, reason, adjustment_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(adj.id.to_string())
        .bind(adj.product_id.to_string())
        .bind(adj.system_quantity.to_string())
        .bind(adj.actual_quantity.to_string())
        .bind(adj.difference.to_string())
        .bind(&adj.reason)
        .bind(adj.adjustment_date.to_rfc3339())
        .bind(adj.created_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &StockAdjustmentId) -> Result<Option<StockAdjustment>, AppError> {
        let row = sqlx::query_as::<_, AdjustmentRow>(
            "SELECT id, product_id, system_quantity, actual_quantity, difference, reason, adjustment_date, created_at
             FROM stock_adjustments WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        row.map(row_to_adjustment).transpose()
    }

    async fn list_all(&self) -> Result<Vec<StockAdjustment>, AppError> {
        let rows = sqlx::query_as::<_, AdjustmentRow>(
            "SELECT id, product_id, system_quantity, actual_quantity, difference, reason, adjustment_date, created_at
             FROM stock_adjustments ORDER BY adjustment_date DESC"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        rows.into_iter().map(row_to_adjustment).collect()
    }
}

