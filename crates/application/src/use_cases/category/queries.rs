use crate::dto::category_dto::CategoryDto;
use crate::errors::AppError;
use crate::ports::category_repository::CategoryRepository;
use domain::inventory::category::{MaterialCategory, DEFAULT_CATEGORY_NAME};
use std::sync::Arc;

const UNCATEGORIZED_SYSTEM_KEY: &str = "inventory.category.uncategorized";
const GENERAL_SUBCATEGORY_SYSTEM_KEY: &str = "inventory.category.general-sub";

fn resolve_system_key(
    category: &MaterialCategory,
    categories: &[MaterialCategory],
) -> Option<String> {
    if category.is_default() {
        return Some(UNCATEGORIZED_SYSTEM_KEY.to_string());
    }

    let parent_id = category.parent_id.as_ref()?;
    let parent = categories
        .iter()
        .find(|candidate| candidate.id == *parent_id && candidate.is_root())?;

    let trimmed = category.name.trim();
    let parent_trimmed = parent.name.trim();
    let legacy_arabic_name = format!("{} عام", parent_trimmed);
    let legacy_english_name = format!("{} General", parent_trimmed);

    if trimmed == parent_trimmed
        || trimmed == legacy_arabic_name
        || trimmed == legacy_english_name
        || trimmed == "عام"
        || trimmed.eq_ignore_ascii_case("general")
    {
        return Some(GENERAL_SUBCATEGORY_SYSTEM_KEY.to_string());
    }

    None
}

pub struct CategoryQueries {
    repo: Arc<dyn CategoryRepository>,
}

impl CategoryQueries {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_all(&self) -> Result<Vec<CategoryDto>, AppError> {
        let categories = self.repo.list_all().await?;
        let mut dtos = vec![];
        for cat in &categories {
            let mut dto = CategoryDto::from(cat.clone());
            dto.system_key = resolve_system_key(cat, &categories);
            if dto.name == DEFAULT_CATEGORY_NAME
                && (dto.code_prefix.is_none() || dto.code_prefix.as_ref().unwrap().is_empty())
            {
                dto.code_prefix = Some("غ".to_string());
            }
            let count = self
                .repo
                .count_materials_in_category(&dto.id.parse().unwrap())
                .await?;
            dto.material_count = count;
            dtos.push(dto);
        }
        Ok(dtos)
    }
}
