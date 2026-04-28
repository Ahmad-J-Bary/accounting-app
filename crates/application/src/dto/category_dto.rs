use domain::inventory::category::MaterialCategory;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDto {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub is_active: bool,
    pub is_hybrid: bool,
    pub code_prefix: Option<String>,
    pub material_count: u64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridCategoryDto {
    pub id: String,
    pub name: String,
    pub prefixes: Vec<String>,
    pub separator: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryPrefixDto {
    pub category_id: String,
    pub prefix: String,
    pub next_seq: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub parent_id: Option<String>,
    pub is_hybrid: Option<bool>,
    pub code_prefix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCategoryRequest {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub is_active: bool,
    pub code_prefix: Option<String>,
}

impl From<MaterialCategory> for CategoryDto {
    fn from(category: MaterialCategory) -> Self {
        Self {
            id: category.id.0.to_string(),
            name: category.name,
            parent_id: category.parent_id.map(|id| id.0.to_string()),
            is_active: category.is_active,
            is_hybrid: category.is_hybrid,
            code_prefix: category.code_prefix,
            material_count: 0, // Filled by application layer
            created_at: category.created_at.to_rfc3339(),
            updated_at: category.updated_at.to_rfc3339(),
        }
    }
}
