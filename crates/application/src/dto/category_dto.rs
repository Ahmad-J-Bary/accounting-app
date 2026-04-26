use domain::inventory::category::MaterialCategory;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDto {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub is_active: bool,
    pub material_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCategoryRequest {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub is_active: bool,
}

impl From<MaterialCategory> for CategoryDto {
    fn from(category: MaterialCategory) -> Self {
        Self {
            id: category.id.0.to_string(),
            name: category.name,
            parent_id: category.parent_id.map(|id| id.0.to_string()),
            is_active: category.is_active,
            material_count: 0, // Filled by application layer
        }
    }
}
