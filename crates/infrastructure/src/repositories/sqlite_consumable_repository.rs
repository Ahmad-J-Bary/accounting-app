use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use application::errors::AppError;
use application::ports::consumable_repository::ConsumableRepository;
use domain::assets::{Consumable, ConsumableId, ConsumableStatus};
use std::sync::Arc;
use crate::db::mapper::{map_uuid, map_decimal, map_money, map_datetime};

pub struct SqliteConsumableRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteConsumableRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ConsumableRepository for SqliteConsumableRepository {
    async fn save(&self, consumable: &Consumable) -> Result<(), AppError> {
        sqlx::query(
            "INSERT OR REPLACE INTO consumables (id, code, name, category_id, quantity_on_hand, unit_cost, currency, fx_rate, status, location, notes, asset_account_id, expense_account_id, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(consumable.id.0.to_string())
        .bind(&consumable.code)
        .bind(&consumable.name)
        .bind(consumable.category_id.to_string())
        .bind(consumable.quantity_on_hand.to_string())
        .bind(consumable.unit_cost.amount().to_string())
        .bind(consumable.unit_cost.currency().code().to_string())
        .bind(consumable.fx_rate.to_string())
        .bind(format!("{:?}", consumable.status))
        .bind(&consumable.location)
        .bind(&consumable.notes)
        .bind(consumable.asset_account_id.to_string())
        .bind(consumable.expense_account_id.to_string())
        .bind(consumable.created_at.to_rfc3339())
        .bind(consumable.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &ConsumableId) -> Result<Option<Consumable>, AppError> {
        let row = sqlx::query("SELECT * FROM consumables WHERE id = ?")
            .bind(id.0.to_string())
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = row {
            Ok(Some(self.map_row_to_consumable(row)?))
        } else {
            Ok(None)
        }
    }

    async fn list_all(&self) -> Result<Vec<Consumable>, AppError> {
        let rows = sqlx::query("SELECT * FROM consumables ORDER BY code ASC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(self.map_row_to_consumable(row)?);
        }
        Ok(items)
    }

    async fn delete(&self, id: &ConsumableId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM consumables WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

impl SqliteConsumableRepository {
    fn map_row_to_consumable(&self, row: sqlx::sqlite::SqliteRow) -> Result<Consumable, AppError> {
        Ok(Consumable {
            id: ConsumableId(map_uuid(&row, "id")),
            code: row.get("code"),
            name: row.get("name"),
            category_id: map_uuid(&row, "category_id"),
            quantity_on_hand: map_decimal(&row, "quantity_on_hand"),
            unit_cost: map_money(&row, "unit_cost", "currency"),
            fx_rate: map_decimal(&row, "fx_rate"),
            status: match row.get::<String, _>("status").as_str() {
                "Exhausted" => ConsumableStatus::Exhausted,
                "Damaged" => ConsumableStatus::Damaged,
                _ => ConsumableStatus::InStock,
            },
            location: row.get("location"),
            notes: row.get("notes"),
            asset_account_id: map_uuid(&row, "asset_account_id"),
            expense_account_id: map_uuid(&row, "expense_account_id"),
            created_at: map_datetime(&row, "created_at"),
            updated_at: map_datetime(&row, "updated_at"),
        })
    }
}
