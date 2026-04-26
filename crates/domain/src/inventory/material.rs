use crate::shared::errors::DomainError;
use crate::shared::ids::{MaterialId, MaterialCategoryId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub id: MaterialId,
    pub name: String,
    pub barcode: String,
    pub code: String,
    pub is_active: bool,
    pub minimum_stock: rust_decimal::Decimal,
    pub category_ids: Vec<MaterialCategoryId>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Material {
    pub fn new(
        name: String,
        barcode: Option<String>,
        code: Option<String>,
        minimum_stock: rust_decimal::Decimal,
        category_ids: Vec<MaterialCategoryId>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم المادة لا يمكن أن يكون فارغًا".into()));
        }

        // Smart Barcode/Code logic
        let (final_barcode, final_code) = match (barcode, code) {
            (Some(b), Some(c)) => (b, c),
            (Some(b), None) => (b.clone(), b),
            (None, Some(c)) => (c.clone(), c),
            (None, None) => {
                let id = uuid::Uuid::new_v4().to_string();
                (id.clone(), id)
            }
        };

        let now = Utc::now();
        
        Ok(Self {
            id: MaterialId::new(),
            name,
            barcode: final_barcode,
            code: final_code,
            is_active: true,
            minimum_stock,
            category_ids,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }

    pub fn update_categories(&mut self, category_ids: Vec<MaterialCategoryId>) {
        self.category_ids = category_ids;
        self.updated_at = Utc::now();
    }
}
