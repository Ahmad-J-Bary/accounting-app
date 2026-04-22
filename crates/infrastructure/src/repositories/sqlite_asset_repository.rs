use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use application::errors::AppError;
use application::ports::asset_repository::AssetRepository;
use domain::assets::{FixedAsset, FixedAssetId, AssetCategory, AssetType, AssetMovement, AssetMovementType, AssetStatus, DepreciationSchedule, DepreciationStatus};
use domain::shared::{Money, Currency};
use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use crate::db::mapper::{map_uuid, map_decimal, map_money, map_datetime};

pub struct SqliteAssetRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteAssetRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AssetRepository for SqliteAssetRepository {
    async fn save_asset(&self, asset: &FixedAsset) -> Result<(), AppError> {
        sqlx::query(
            "INSERT OR REPLACE INTO fixed_assets (id, code, name, category_id, purchase_date, purchase_cost, currency, fx_rate, useful_life_months, salvage_value, accumulated_depreciation, status, location, notes, asset_account_id, depreciation_account_id, accumulated_depreciation_account_id, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(asset.id.0.to_string())
        .bind(&asset.code)
        .bind(&asset.name)
        .bind(asset.category_id.to_string())
        .bind(asset.purchase_date.to_rfc3339())
        .bind(asset.purchase_cost.amount().to_string())
        .bind(asset.purchase_cost.currency().code().to_string())
        .bind(asset.fx_rate.to_string())
        .bind(asset.useful_life_months as i64)
        .bind(asset.salvage_value.as_ref().map(|m| m.amount().to_string()))
        .bind(asset.accumulated_depreciation.amount().to_string())
        .bind(format!("{:?}", asset.status))
        .bind(&asset.location)
        .bind(&asset.notes)
        .bind(asset.asset_account_id.to_string())
        .bind(asset.depreciation_account_id.to_string())
        .bind(asset.accumulated_depreciation_account_id.to_string())
        .bind(asset.created_at.to_rfc3339())
        .bind(asset.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_asset_by_id(&self, id: &FixedAssetId) -> Result<Option<FixedAsset>, AppError> {
        let row = sqlx::query("SELECT * FROM fixed_assets WHERE id = ?")
            .bind(id.0.to_string())
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = row {
            Ok(Some(self.map_row_to_asset(row)?))
        } else {
            Ok(None)
        }
    }

    async fn list_assets(&self) -> Result<Vec<FixedAsset>, AppError> {
        let rows = sqlx::query("SELECT * FROM fixed_assets ORDER BY code ASC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut assets = Vec::new();
        for row in rows {
            assets.push(self.map_row_to_asset(row)?);
        }
        Ok(assets)
    }

    async fn save_category(&self, category: &AssetCategory) -> Result<(), AppError> {
        sqlx::query("INSERT OR REPLACE INTO asset_categories (id, name, asset_type) VALUES (?, ?, ?)")
            .bind(category.id.to_string())
            .bind(&category.name)
            .bind(format!("{:?}", category.asset_type))
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn list_categories(&self, asset_type: AssetType) -> Result<Vec<AssetCategory>, AppError> {
        let rows = sqlx::query("SELECT * FROM asset_categories WHERE asset_type = ?")
            .bind(format!("{:?}", asset_type))
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut categories = Vec::new();
        for row in rows {
            categories.push(AssetCategory {
                id: map_uuid(&row, "id"),
                name: row.get("name"),
                asset_type: match row.get::<String, _>("asset_type").as_str() {
                    "Fixed" => AssetType::Fixed,
                    _ => AssetType::Consumable,
                },
            });
        }
        Ok(categories)
    }

    async fn save_movement(&self, movement: &AssetMovement) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO asset_movements (id, asset_id, movement_type, movement_date, quantity, amount, description, reference_no, journal_entry_id, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(movement.id.to_string())
        .bind(movement.asset_id.to_string())
        .bind(format!("{:?}", movement.movement_type))
        .bind(movement.date.to_rfc3339())
        .bind(movement.quantity.map(|q| q.to_string()))
        .bind(movement.amount.amount().to_string())
        .bind(&movement.description)
        .bind(&movement.reference_no)
        .bind(movement.journal_entry_id.map(|id| id.to_string()))
        .bind(movement.created_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn list_movements_by_asset(&self, asset_id: &Uuid) -> Result<Vec<AssetMovement>, AppError> {
        let rows = sqlx::query("SELECT * FROM asset_movements WHERE asset_id = ? ORDER BY movement_date DESC")
            .bind(asset_id.to_string())
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        self.map_movement_rows(rows)
    }

    async fn list_all_movements(&self) -> Result<Vec<AssetMovement>, AppError> {
        let rows = sqlx::query("SELECT * FROM asset_movements ORDER BY movement_date DESC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        self.map_movement_rows(rows)
    }

    async fn save_depreciation_schedule(&self, schedule: &DepreciationSchedule) -> Result<(), AppError> {
        sqlx::query(
            "INSERT OR REPLACE INTO depreciation_schedules (id, fixed_asset_id, period_date, depreciation_amount, accumulated_depreciation, remaining_value, status, journal_entry_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(schedule.id.to_string())
        .bind(schedule.fixed_asset_id.to_string())
        .bind(schedule.period_date.to_rfc3339())
        .bind(schedule.depreciation_amount.amount().to_string())
        .bind(schedule.accumulated_depreciation.amount().to_string())
        .bind(schedule.remaining_value.amount().to_string())
        .bind(format!("{:?}", schedule.status))
        .bind(schedule.journal_entry_id.map(|id| id.to_string()))
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn get_depreciation_schedule(&self, asset_id: &Uuid) -> Result<Vec<DepreciationSchedule>, AppError> {
        let rows = sqlx::query("SELECT * FROM depreciation_schedules WHERE fixed_asset_id = ? ORDER BY period_date ASC")
            .bind(asset_id.to_string())
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut schedules = Vec::new();
        for row in rows {
             schedules.push(DepreciationSchedule {
                id: map_uuid(&row, "id"),
                fixed_asset_id: map_uuid(&row, "fixed_asset_id"),
                period_date: map_datetime(&row, "period_date"),
                depreciation_amount: map_money(&row, "depreciation_amount", "currency"), // Note: currency is fixed to SYP in migration for these but should be consistent
                accumulated_depreciation: map_money(&row, "accumulated_depreciation", "currency"),
                remaining_value: map_money(&row, "remaining_value", "currency"),
                status: match row.get::<String, _>("status").as_str() {
                    "Posted" => DepreciationStatus::Posted,
                    _ => DepreciationStatus::Pending,
                },
                journal_entry_id: row.get::<Option<String>, _>("journal_entry_id").and_then(|s| Uuid::parse_str(&s).ok()),
             });
        }
        Ok(schedules)
    }
}

impl SqliteAssetRepository {
    fn map_row_to_asset(&self, row: sqlx::sqlite::SqliteRow) -> Result<FixedAsset, AppError> {
        Ok(FixedAsset {
            id: FixedAssetId(map_uuid(&row, "id")),
            code: row.get("code"),
            name: row.get("name"),
            category_id: map_uuid(&row, "category_id"),
            purchase_date: map_datetime(&row, "purchase_date"),
            purchase_cost: map_money(&row, "purchase_cost", "currency"),
            fx_rate: map_decimal(&row, "fx_rate"),
            useful_life_months: row.get::<i64, _>("useful_life_months") as u32,
            salvage_value: row.get::<Option<String>, _>("salvage_value").and_then(|s| Decimal::from_str(&s).ok()).map(|d| Money::new(d, Currency::SYP)), // Should use map_money if currency col existed for salvage
            accumulated_depreciation: map_money(&row, "accumulated_depreciation", "currency"),
            status: match row.get::<String, _>("status").as_str() {
                "Disposed" => AssetStatus::Disposed,
                "Sold" => AssetStatus::Sold,
                "Damaged" => AssetStatus::Damaged,
                _ => AssetStatus::Active,
            },
            location: row.get("location"),
            notes: row.get("notes"),
            asset_account_id: map_uuid(&row, "asset_account_id"),
            depreciation_account_id: map_uuid(&row, "depreciation_account_id"),
            accumulated_depreciation_account_id: map_uuid(&row, "accumulated_depreciation_account_id"),
            created_at: map_datetime(&row, "created_at"),
            updated_at: map_datetime(&row, "updated_at"),
        })
    }

    fn map_movement_rows(&self, rows: Vec<sqlx::sqlite::SqliteRow>) -> Result<Vec<AssetMovement>, AppError> {
        let mut movements = Vec::new();
        for row in rows {
            movements.push(AssetMovement {
                id: map_uuid(&row, "id"),
                asset_id: map_uuid(&row, "asset_id"),
                movement_type: match row.get::<String, _>("movement_type").as_str() {
                    "Acquisition" => AssetMovementType::Acquisition,
                    "Depreciation" => AssetMovementType::Depreciation,
                    "Disposal" => AssetMovementType::Disposal,
                    "Sale" => AssetMovementType::Sale,
                    "Adjustment" => AssetMovementType::Adjustment,
                    "Transfer" => AssetMovementType::Transfer,
                    "Issue" => AssetMovementType::Issue,
                    "Consumption" => AssetMovementType::Consumption,
                    "Damage" => AssetMovementType::Damage,
                    _ => AssetMovementType::Revaluation,
                },
                date: map_datetime(&row, "movement_date"),
                quantity: row.get::<Option<String>, _>("quantity").and_then(|s| Decimal::from_str(&s).ok()),
                amount: map_money(&row, "amount", "currency"), // Fallback in mapper for missing currency
                description: row.get("description"),
                reference_no: row.get("reference_no"),
                journal_entry_id: row.get::<Option<String>, _>("journal_entry_id").and_then(|s| Uuid::parse_str(&s).ok()),
                created_at: map_datetime(&row, "created_at"),
            });
        }
        Ok(movements)
    }
}
