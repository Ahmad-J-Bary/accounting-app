use async_trait::async_trait;
use sqlx::SqlitePool;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{StockMovementId, MaterialId};
use application::ports::stock_movement_repository::StockMovementRepository;
use application::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::{DateTime, Utc};
use std::sync::Arc;

pub struct SqliteStockMovementRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteStockMovementRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct StockMovementRow {
    id: String,
    material_id: String,
    quantity: String,
    movement_type: String,
    reason: Option<String>,
    reference: Option<String>,
    movement_date: String,
    created_at: String,
}

fn row_to_movement(row: StockMovementRow) -> Result<StockMovement, AppError> {
    let m_type = match row.movement_type.as_str() {
        "In" | "MovementType::In" => MovementType::In,
        "Out" | "MovementType::Out" => MovementType::Out,
        "Transfer" | "MovementType::Transfer" => MovementType::Transfer,
        "Adjustment" | "MovementType::Adjustment" => MovementType::Adjustment,
        "OpeningBalance" | "MovementType::OpeningBalance" => MovementType::OpeningBalance,
        "Damaged" | "MovementType::Damaged" => MovementType::Damaged,
        "Sale" | "MovementType::Sale" => MovementType::Sale,
        "Purchase" | "MovementType::Purchase" => MovementType::Purchase,
        _ => MovementType::Adjustment,
    };

    Ok(StockMovement {
        id: uuid::Uuid::from_str(&row.id).map_err(|e| AppError::Invalid(e.to_string()))?,
        material_id: MaterialId(uuid::Uuid::from_str(&row.material_id).map_err(|e| AppError::Invalid(e.to_string()))?),
        movement_type: m_type,
        quantity: Decimal::from_str(&row.quantity).map_err(|e| AppError::Invalid(e.to_string()))?,
        reference: row.reference.unwrap_or_default(),
        notes: row.reason.unwrap_or_default(),
        movement_date: DateTime::parse_from_rfc3339(&row.movement_date).map_err(|e| AppError::Invalid(e.to_string()))?.with_timezone(&Utc),
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map_err(|e| AppError::Invalid(e.to_string()))?.with_timezone(&Utc),
    })
}

#[async_trait]
impl StockMovementRepository for SqliteStockMovementRepository {
    async fn save(&self, movement: &StockMovement) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO stock_movements (id, material_id, quantity, movement_type, reason, reference, movement_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(movement.id.to_string())
        .bind(movement.material_id.to_string())
        .bind(movement.quantity.to_string())
        .bind(format!("{:?}", movement.movement_type))
        .bind(&movement.notes)
        .bind(&movement.reference)
        .bind(movement.movement_date.to_rfc3339())
        .bind(movement.created_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(())
    }

    async fn find_by_id(&self, id: &StockMovementId) -> Result<Option<StockMovement>, AppError> {
        let row = sqlx::query_as::<_, StockMovementRow>(
            "SELECT id, material_id, quantity, movement_type, reason, reference, movement_date, created_at FROM stock_movements WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_movement).transpose()
    }

    async fn list_all(&self) -> Result<Vec<StockMovement>, AppError> {
        let rows = sqlx::query_as::<_, StockMovementRow>("SELECT * FROM stock_movements ORDER BY movement_date DESC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_movement).collect()
    }

    async fn list_by_material(&self, material_id: &MaterialId) -> Result<Vec<StockMovement>, AppError> {
        let rows = sqlx::query_as::<_, StockMovementRow>(
            "SELECT * FROM stock_movements WHERE material_id = ? ORDER BY movement_date DESC"
        )
        .bind(material_id.to_string())
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_movement).collect()
    }

    async fn get_stock_balance(&self, material_id: &MaterialId) -> Result<Decimal, AppError> {
        let movements = self.list_by_material(material_id).await?;
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
}
