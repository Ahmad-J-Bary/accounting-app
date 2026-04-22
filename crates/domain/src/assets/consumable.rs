use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::shared::Money;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsumableId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConsumableStatus {
    InStock,
    Exhausted,
    Damaged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consumable {
    pub id: ConsumableId,
    pub code: String,
    pub name: String,
    pub category_id: Uuid,
    pub quantity_on_hand: Decimal,
    pub unit_cost: Money,
    pub fx_rate: Decimal,
    pub status: ConsumableStatus,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Consumable {
    pub fn new(
        code: String,
        name: String,
        category_id: Uuid,
        unit_cost: Money,
        fx_rate: Decimal,
    ) -> Self {
        Self {
            id: ConsumableId(Uuid::new_v4()),
            code,
            name,
            category_id,
            quantity_on_hand: Decimal::ZERO,
            unit_cost,
            fx_rate,
            status: ConsumableStatus::InStock,
            location: None,
            notes: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn total_cost(&self) -> Money {
        self.unit_cost.clone() * self.quantity_on_hand
    }
}
