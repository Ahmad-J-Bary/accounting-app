use crate::shared::errors::DomainError;
use crate::shared::ids::{SalesReturnId, MaterialId, CustomerId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesReturnLine {
    pub id: Uuid,
    pub material_id: MaterialId,
    pub quantity: Decimal,
    pub unit_price: Decimal,
    pub unit_id: Option<String>,
    pub line_total: Decimal,
    pub notes: Option<String>,
}

impl SalesReturnLine {
    pub fn new(
        material_id: MaterialId,
        quantity: Decimal,
        unit_price: Decimal,
        unit_id: Option<String>,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if quantity <= Decimal::ZERO {
            return Err(DomainError::Invalid("الكمية يجب أن تكون أكبر من صفر".into()));
        }
        if unit_price < Decimal::ZERO {
            return Err(DomainError::Invalid("السعر لا يمكن أن يكون سالباً".into()));
        }
        Ok(Self {
            id: Uuid::new_v4(),
            material_id,
            quantity,
            unit_price,
            unit_id,
            line_total: quantity * unit_price,
            notes,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesReturn {
    pub id: SalesReturnId,
    pub return_number: String,
    pub customer_id: CustomerId,
    pub return_date: DateTime<Utc>,
    pub lines: Vec<SalesReturnLine>,
    pub total_amount: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SalesReturn {
    pub fn new(
        return_number: String,
        customer_id: CustomerId,
        return_date: DateTime<Utc>,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if return_number.trim().is_empty() {
            return Err(DomainError::Invalid("رقم المرتجع لا يمكن أن يكون فارغاً".into()));
        }
        Ok(Self {
            id: SalesReturnId::new(),
            return_number,
            customer_id,
            return_date,
            lines: Vec::new(),
            total_amount: Decimal::ZERO,
            notes,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    pub fn add_line(&mut self, line: SalesReturnLine) -> Result<(), DomainError> {
        self.lines.push(line);
        self.recalculate_total();
        Ok(())
    }

    pub fn remove_line(&mut self, line_id: Uuid) {
        self.lines.retain(|l| l.id != line_id);
        self.recalculate_total();
    }

    fn recalculate_total(&mut self) {
        self.total_amount = self.lines.iter().map(|l| l.line_total).sum();
        self.updated_at = Utc::now();
    }
}
