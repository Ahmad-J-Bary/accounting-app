use crate::shared::errors::DomainError;
use crate::shared::ids::MaterialId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MovementType {
    In,             // إدخال يدوي
    Out,            // إخراج يدوي
    Transfer,       // نقل
    Adjustment,     // تسوية جرد
    OpeningBalance, // فاتورة أول المدة
    Damaged,        // تالف وهدر
    Sale,           // مبيعات
    Purchase,       // مشتريات
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovement {
    pub id: Uuid,
    pub material_id: MaterialId,
    pub movement_type: MovementType,
    pub quantity: Decimal,
    pub unit_cost: Decimal,
    pub total_cost: Decimal,
    pub reference: String, // رقم الفاتورة أو المستند
    pub notes: String,
    pub movement_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

impl StockMovement {
    pub fn new(
        material_id: MaterialId,
        movement_type: MovementType,
        quantity: Decimal,
        unit_cost: Decimal,
        total_cost: Decimal,
        reference: String,
        notes: String,
        movement_date: DateTime<Utc>,
    ) -> Result<Self, DomainError> {
        if quantity <= Decimal::ZERO {
            return Err(DomainError::Invalid(
                "الكمية يجب أن تكون أكبر من صفر".into(),
            ));
        }

        if reference.trim().is_empty() {
            return Err(DomainError::Invalid("المرجع لا يمكن أن يكون فارغًا".into()));
        }

        let now = Utc::now();

        Ok(Self {
            id: Uuid::new_v4(),
            material_id,
            movement_type,
            quantity,
            unit_cost,
            total_cost,
            reference,
            notes,
            movement_date,
            created_at: now,
        })
    }

    pub fn is_inflow(&self) -> bool {
        matches!(
            self.movement_type,
            MovementType::In
                | MovementType::Transfer
                | MovementType::OpeningBalance
                | MovementType::Purchase
        )
    }

    pub fn is_outflow(&self) -> bool {
        matches!(
            self.movement_type,
            MovementType::Out
                | MovementType::Transfer
                | MovementType::Damaged
                | MovementType::Sale
                | MovementType::Adjustment
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn stock_movement_creation_with_valid_data_succeeds() {
        let result = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::In,
            dec!(100),
            dec!(10.5),
            dec!(1050),
            "INV-001".to_string(),
            "إدخال مخزون".to_string(),
            Utc::now(),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn stock_movement_quantity_must_be_positive() {
        let result = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::In,
            dec!(-10),
            dec!(0),
            dec!(0),
            "INV-001".to_string(),
            "إدخال مخزون".to_string(),
            Utc::now(),
        );

        assert!(result.is_err());
    }

    #[test]
    fn stock_movement_reference_cannot_be_empty() {
        let result = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::In,
            dec!(100),
            dec!(0),
            dec!(0),
            "".to_string(),
            "إدخال مخزون".to_string(),
            Utc::now(),
        );

        assert!(result.is_err());
    }

    #[test]
    fn in_movement_is_inflow() {
        let movement = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::In,
            dec!(100),
            dec!(0),
            dec!(0),
            "INV-001".to_string(),
            "إدخال مخزون".to_string(),
            Utc::now(),
        )
        .unwrap();

        assert!(movement.is_inflow());
    }

    #[test]
    fn out_movement_is_outflow() {
        let movement = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::Out,
            dec!(100),
            dec!(0),
            dec!(0),
            "INV-001".to_string(),
            "إخراج مخزون".to_string(),
            Utc::now(),
        )
        .unwrap();

        assert!(movement.is_outflow());
    }

    #[test]
    fn transfer_is_both_inflow_and_outflow() {
        let movement = StockMovement::new(
            MaterialId(Uuid::new_v4()),
            MovementType::Transfer,
            dec!(100),
            dec!(0),
            dec!(0),
            "TRF-001".to_string(),
            "نقل مخزون".to_string(),
            Utc::now(),
        )
        .unwrap();

        assert!(movement.is_inflow());
        assert!(movement.is_outflow());
    }
}
