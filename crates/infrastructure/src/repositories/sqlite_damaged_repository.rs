use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::damaged_item_repository::DamagedItemRepository;
use domain::inventory::DamagedItem;
use domain::shared::ids::{DamagedItemId, ProductId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

pub struct SqliteDamagedItemRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteDamagedItemRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct DamagedItemRow {
    id: String,
    product_id: String,
    quantity: String,
    reason: String,
    damage_date: String,
    cost_impact: String,
    notes: Option<String>,
    created_at: String,
}

fn row_to_damaged(row: DamagedItemRow) -> Result<DamagedItem, AppError> {
    Ok(DamagedItem {
        id: DamagedItemId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        product_id: ProductId(Uuid::parse_str(&row.product_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        quantity: Decimal::from_str(&row.quantity).unwrap_or(Decimal::ZERO),
        reason: row.reason,
        damage_date: DateTime::parse_from_rfc3339(&row.damage_date).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        cost_impact: Decimal::from_str(&row.cost_impact).unwrap_or(Decimal::ZERO),
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl DamagedItemRepository for SqliteDamagedItemRepository {
    async fn save(&self, item: &DamagedItem) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO damaged_items (id, product_id, quantity, reason, damage_date, cost_impact, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(item.id.to_string())
        .bind(item.product_id.to_string())
        .bind(item.quantity.to_string())
        .bind(&item.reason)
        .bind(item.damage_date.to_rfc3339())
        .bind(item.cost_impact.to_string())
        .bind(&item.notes)
        .bind(item.created_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &DamagedItemId) -> Result<Option<DamagedItem>, AppError> {
        let row = sqlx::query_as::<_, DamagedItemRow>(
            "SELECT id, product_id, quantity, reason, damage_date, cost_impact, notes, created_at
             FROM damaged_items WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        row.map(row_to_damaged).transpose()
    }

    async fn list_all(&self) -> Result<Vec<DamagedItem>, AppError> {
        let rows = sqlx::query_as::<_, DamagedItemRow>(
            "SELECT id, product_id, quantity, reason, damage_date, cost_impact, notes, created_at
             FROM damaged_items ORDER BY damage_date DESC"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        rows.into_iter().map(row_to_damaged).collect()
    }

    async fn delete(&self, id: &DamagedItemId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM damaged_items WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

