use crate::shared::errors::DomainError;
use crate::shared::ids::{MaterialId, MaterialCategoryId};
use crate::shared::money::Money;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub id: MaterialId,
    pub name: String,
    pub barcode: String,
    pub code: String,
    pub purchase_price: Option<Money>,
    pub retail_price: Option<Money>,
    pub wholesale_price: Option<Money>,
    pub semi_wholesale_price: Option<Money>,
    pub minimum_stock: Decimal,
    pub is_active: bool,
    pub notes: Option<String>,
    pub category_ids: Vec<MaterialCategoryId>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Material {
    pub fn new(
        name: String,
        barcode: Option<String>,
        code: Option<String>,
        purchase_price: Option<Money>,
        retail_price: Option<Money>,
        wholesale_price: Option<Money>,
        semi_wholesale_price: Option<Money>,
        minimum_stock: Decimal,
        notes: Option<String>,
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
        
        let mut categories = category_ids;
        if categories.is_empty() {
            // Default to "General" category if not provided
            // This assumes the General category ID is known or will be handled by the application layer
            // For domain purity, we might just leave it empty and let Application layer enforce it,
            // but the user said "assigned automatically if none specified".
        }

        Ok(Self {
            id: MaterialId::new(),
            name,
            barcode: final_barcode,
            code: final_code,
            purchase_price,
            retail_price,
            wholesale_price,
            semi_wholesale_price,
            minimum_stock,
            is_active: true,
            notes,
            category_ids: categories,
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
