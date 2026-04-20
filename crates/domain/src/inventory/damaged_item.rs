use crate::shared::errors::DomainError;
use crate::shared::ids::{DamagedItemId, ProductId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamagedItem {
    pub id: DamagedItemId,
    pub product_id: ProductId,
    pub quantity: Decimal,
    pub reason: String,
    pub damage_date: DateTime<Utc>,
    pub cost_impact: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl DamagedItem {
    pub fn new(
        product_id: ProductId,
        quantity: Decimal,
        reason: String,
        damage_date: DateTime<Utc>,
        cost_impact: Decimal,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if quantity <= Decimal::ZERO {
            return Err(DomainError::Invalid("كمية التالف يجب أن تكون موجبة".into()));
        }
        if reason.trim().is_empty() {
            return Err(DomainError::Invalid("سبب التلف لا يمكن أن يكون فارغًا".into()));
        }
        if cost_impact < Decimal::ZERO {
            return Err(DomainError::Invalid("قيمة التكلفة لا يمكن أن تكون سالبة".into()));
        }
        Ok(Self {
            id: DamagedItemId(Uuid::new_v4()),
            product_id,
            quantity,
            reason,
            damage_date,
            cost_impact,
            notes,
            created_at: Utc::now(),
        })
    }
}
