use crate::shared::errors::DomainError;
use crate::shared::ids::MaterialCategoryId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialCategory {
    pub id: MaterialCategoryId,
    pub name: String,
    pub parent_id: Option<MaterialCategoryId>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl MaterialCategory {
    pub fn new(
        name: String,
        parent_id: Option<MaterialCategoryId>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم التصنيف لا يمكن أن يكون فارغًا".into()));
        }

        let now = Utc::now();

        Ok(Self {
            id: MaterialCategoryId::new(),
            name,
            parent_id,
            is_active: true,
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
}
