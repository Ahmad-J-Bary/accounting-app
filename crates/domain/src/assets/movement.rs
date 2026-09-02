use crate::shared::Money;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AssetMovementType {
    Acquisition,
    Depreciation,
    Disposal,
    Sale,
    Adjustment,
    Transfer,
    Issue,
    Consumption,
    Damage,
    Revaluation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetMovement {
    pub id: Uuid,
    pub asset_id: Uuid,
    pub movement_type: AssetMovementType,
    pub date: DateTime<Utc>,
    pub quantity: Option<Decimal>,
    pub amount: Money,
    pub description: String,
    pub reference_no: Option<String>,
    pub journal_entry_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl AssetMovement {
    pub fn new(
        asset_id: Uuid,
        movement_type: AssetMovementType,
        date: DateTime<Utc>,
        amount: Money,
        description: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            asset_id,
            movement_type,
            date,
            quantity: None,
            amount,
            description,
            reference_no: None,
            journal_entry_id: None,
            created_at: Utc::now(),
        }
    }
}
