use crate::shared::errors::DomainError;
use crate::shared::ids::{MaterialId, ProductionOrderId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProductionOrderStatus {
    Draft,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMaterial {
    pub id: String,
    pub material_id: MaterialId, // raw material
    pub quantity_required: Decimal,
    pub quantity_consumed: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionOutput {
    pub id: String,
    pub material_id: MaterialId, // finished good
    pub quantity_produced: Decimal,
    pub unit_cost: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionOrder {
    pub id: ProductionOrderId,
    pub order_number: String,
    pub materials: Vec<ProductionMaterial>,
    pub outputs: Vec<ProductionOutput>,
    pub status: ProductionOrderStatus,
    pub production_date: DateTime<Utc>,
    pub notes: Option<String>,
    pub total_cost: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ProductionOrder {
    pub fn new(
        order_number: String,
        production_date: DateTime<Utc>,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if order_number.trim().is_empty() {
            return Err(DomainError::Invalid(
                "رقم أمر الإنتاج لا يمكن أن يكون فارغًا".into(),
            ));
        }
        let now = Utc::now();
        Ok(Self {
            id: ProductionOrderId(Uuid::new_v4()),
            order_number,
            materials: vec![],
            outputs: vec![],
            status: ProductionOrderStatus::Draft,
            production_date,
            notes,
            total_cost: Decimal::ZERO,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn add_material(
        &mut self,
        material_id: MaterialId,
        quantity_required: Decimal,
    ) -> Result<(), DomainError> {
        if self.status == ProductionOrderStatus::Completed {
            return Err(DomainError::Forbidden(
                "لا يمكن تعديل أمر إنتاج مكتمل".into(),
            ));
        }
        if quantity_required <= Decimal::ZERO {
            return Err(DomainError::Invalid(
                "كمية المادة الخام يجب أن تكون موجبة".into(),
            ));
        }
        self.materials.push(ProductionMaterial {
            id: Uuid::new_v4().to_string(),
            material_id,
            quantity_required,
            quantity_consumed: Decimal::ZERO,
        });
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn add_output(
        &mut self,
        material_id: MaterialId,
        quantity_produced: Decimal,
        unit_cost: Decimal,
    ) -> Result<(), DomainError> {
        if self.status == ProductionOrderStatus::Completed {
            return Err(DomainError::Forbidden(
                "لا يمكن تعديل أمر إنتاج مكتمل".into(),
            ));
        }
        if quantity_produced <= Decimal::ZERO {
            return Err(DomainError::Invalid("كمية الإنتاج يجب أن تكون موجبة".into()));
        }
        self.outputs.push(ProductionOutput {
            id: Uuid::new_v4().to_string(),
            material_id,
            quantity_produced,
            unit_cost,
        });
        self.recalculate_cost();
        Ok(())
    }

    fn recalculate_cost(&mut self) {
        self.total_cost = self
            .outputs
            .iter()
            .map(|o| o.quantity_produced * o.unit_cost)
            .sum();
        self.updated_at = Utc::now();
    }

    pub fn complete(&mut self) -> Result<(), DomainError> {
        if self.status == ProductionOrderStatus::Completed {
            return Err(DomainError::Invalid("أمر الإنتاج مكتمل مسبقًا".into()));
        }
        if self.status == ProductionOrderStatus::Cancelled {
            return Err(DomainError::Invalid("أمر الإنتاج ملغي".into()));
        }
        if self.materials.is_empty() && self.outputs.is_empty() {
            return Err(DomainError::Invalid("لا يمكن إكمال أمر إنتاج فارغ".into()));
        }
        self.status = ProductionOrderStatus::Completed;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<(), DomainError> {
        if self.status == ProductionOrderStatus::Completed {
            return Err(DomainError::Forbidden(
                "لا يمكن إلغاء أمر إنتاج مكتمل".into(),
            ));
        }
        self.status = ProductionOrderStatus::Cancelled;
        self.updated_at = Utc::now();
        Ok(())
    }
}
