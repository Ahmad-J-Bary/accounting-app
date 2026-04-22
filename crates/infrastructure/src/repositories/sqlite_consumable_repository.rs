use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use application::errors::AppError;
use application::ports::consumable_repository::ConsumableRepository;
use domain::assets::{Consumable, ConsumableId, ConsumableStatus};
use domain::shared::{Money, Currency};
use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

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
            "INSERT OR REPLACE INTO consumables (id, code, name, category_id, quantity_on_hand, unit_cost, currency, fx_rate, status, location, notes, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        let currency_code: String = row.get("currency");
        let currency = match currency_code.as_str() {
            "USD" => Currency::USD,
            _ => Currency::SYP,
        };

        Ok(Consumable {
            id: ConsumableId(Uuid::parse_str(row.get("id")).unwrap_or_default()),
            code: row.get("code"),
            name: row.get("name"),
            category_id: Uuid::parse_str(row.get("category_id")).unwrap_or_default(),
            quantity_on_hand: Decimal::from_str(row.get("quantity_on_hand")).unwrap_or_default(),
            unit_cost: Money::new(Decimal::from_str(row.get("unit_cost")).unwrap_or_default(), currency),
            fx_rate: Decimal::from_str(row.get("fx_rate")).unwrap_or(Decimal::ONE),
            status: match row.get::<String, _>("status").as_str() {
                "Exhausted" => ConsumableStatus::Exhausted,
                "Damaged" => ConsumableStatus::Damaged,
                _ => ConsumableStatus::InStock,
            },
            location: row.get("location"),
            notes: row.get("notes"),
            created_at: DateTime::parse_from_rfc3339(row.get("created_at")).unwrap_or_default().with_timezone(&chrono::Utc),
            updated_at: DateTime::parse_from_rfc3339(row.get("updated_at")).unwrap_or_default().with_timezone(&chrono::Utc),
        })
    }
}
