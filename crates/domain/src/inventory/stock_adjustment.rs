use crate::shared::errors::DomainError;
use crate::shared::ids::{StockAdjustmentId, MaterialId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockAdjustment {
    pub id: StockAdjustmentId,
    pub material_id: MaterialId,
    pub system_quantity: Decimal,
    pub actual_quantity: Decimal,
    pub difference: Decimal,
    pub reason: Option<String>,
    pub unit_cost: Decimal,
    pub notes: Option<String>,
    pub adjustment_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

impl StockAdjustment {
    pub fn new(
        material_id: MaterialId,
        system_quantity: Decimal,
        actual_quantity: Decimal,
        reason: Option<String>,
        unit_cost: Decimal,
        notes: Option<String>,
        adjustment_date: DateTime<Utc>,
    ) -> Result<Self, DomainError> {
        if system_quantity < Decimal::ZERO {
            return Err(DomainError::Invalid(
                "كمية النظام لا يمكن أن تكون سالبة".into(),
            ));
        }
        if actual_quantity < Decimal::ZERO {
            return Err(DomainError::Invalid(
                "الكمية المجرودة لا يمكن أن تكون سالبة".into(),
            ));
        }
        let difference = actual_quantity - system_quantity;
        Ok(Self {
            id: StockAdjustmentId(Uuid::new_v4()),
            material_id,
            system_quantity,
            actual_quantity,
            difference,
            reason,
            unit_cost,
            notes,
            adjustment_date,
            created_at: Utc::now(),
        })
    }

    pub fn is_surplus(&self) -> bool {
        self.difference > Decimal::ZERO
    }

    pub fn is_shortage(&self) -> bool {
        self.difference < Decimal::ZERO
    }
}
