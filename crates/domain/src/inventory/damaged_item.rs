use crate::shared::errors::DomainError;
use crate::shared::ids::{DamagedItemId, MaterialId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamagedItem {
    pub id: DamagedItemId,
    pub material_id: MaterialId,
    pub quantity: Decimal,
    pub reason: String,
    pub damage_date: DateTime<Utc>,
    pub cost_impact: Decimal,
    pub notes: Option<String>,
    pub reference: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl DamagedItem {
    pub fn new(
        material_id: MaterialId,
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
            material_id,
            quantity,
            reason,
            damage_date,
            cost_impact,
            notes,
            reference: None,
            created_at: Utc::now(),
        })
    }
}
