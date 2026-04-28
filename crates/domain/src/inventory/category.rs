use crate::shared::errors::DomainError;
use crate::shared::ids::MaterialCategoryId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub const DEFAULT_CATEGORY_NAME: &str = "غير مصنف";
pub const DEFAULT_CATEGORY_ID: &str = "00000000-0000-0000-0000-000000000001";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialCategory {
    pub id: MaterialCategoryId,
    pub name: String,
    pub parent_id: Option<MaterialCategoryId>,
    pub is_active: bool,
    pub is_hybrid: bool,
    pub code_prefix: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl MaterialCategory {
    pub fn new(
        name: String,
        parent_id: Option<MaterialCategoryId>,
        is_hybrid: bool,
        code_prefix: Option<String>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم التصنيف لا يمكن أن يكون فارغًا".into(),
            ));
        }

        if name.trim() == DEFAULT_CATEGORY_NAME {
            return Err(DomainError::Invalid(
                "لا يمكن إنشاء تصنيف بنفس اسم التصنيف الافتراضي".into(),
            ));
        }

        let now = Utc::now();

        Ok(Self {
            id: MaterialCategoryId::new(),
            name,
            parent_id,
            is_active: true,
            is_hybrid,
            code_prefix,
            created_at: now,
            updated_at: now,
        })
    }

    /// Returns the auto-generated default sub-category name for a root category.
    /// e.g. "ساعات" → "ساعات عام"
    pub fn default_sub_name(&self) -> String {
        format!("{} عام", self.name.trim())
    }

    pub fn is_default(&self) -> bool {
        self.name == DEFAULT_CATEGORY_NAME || self.id.to_string() == DEFAULT_CATEGORY_ID
    }

    pub fn is_root(&self) -> bool {
        self.parent_id.is_none()
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }

    /// Validates if this category can have a child added to it.
    pub fn validate_can_add_child(&self) -> Result<(), DomainError> {
        if self.is_default() {
            return Err(DomainError::Invalid(
                "لا يمكن إضافة تصنيفات فرعية تحت التصنيف الافتراضي".into(),
            ));
        }

        if !self.is_root() {
            return Err(DomainError::Invalid(
                "لا يمكن أن تكون الشجرة أعمق من مستويين. هذا التصنيف هو تصنيف فرعي بالفعل.".into(),
            ));
        }

        Ok(())
    }
}
