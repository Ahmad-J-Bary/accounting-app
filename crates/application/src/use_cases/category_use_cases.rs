use crate::dto::category_dto::{CategoryDto, CreateCategoryRequest, UpdateCategoryRequest};
use crate::errors::AppError;
use crate::ports::category_repository::CategoryRepository;
use domain::inventory::category::{MaterialCategory, DEFAULT_CATEGORY_NAME};
use std::sync::Arc;
use chrono::Utc;

pub struct CategoryUseCases {
    repo: Arc<dyn CategoryRepository>,
}

impl CategoryUseCases {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn create(&self, req: CreateCategoryRequest) -> Result<CategoryDto, AppError> {
        let parent_id = match &req.parent_id {
            Some(pid) if !pid.is_empty() => Some(
                pid.parse()
                    .map_err(|_| AppError::Invalid("معرف الأب غير صالح".into()))?,
            ),
            _ => None,
        };

        // Validate depth: parent must be a root (no grandparent)
        if let Some(ref pid) = parent_id {
            let parent = self
                .repo
                .find_by_id(pid)
                .await?
                .ok_or_else(|| AppError::NotFound("التصنيف الأب غير موجود".into()))?;
            if parent.parent_id.is_some() {
                return Err(AppError::Invalid(
                    "لا يمكن إضافة مستوى ثالث. أقصى عمق مستويين فقط.".into(),
                ));
            }
            if parent.is_default() {
                return Err(AppError::Invalid(format!(
                    "لا يمكن إضافة فرع تحت «{}»",
                    DEFAULT_CATEGORY_NAME
                )));
            }
        }

        let is_hybrid = req.is_hybrid.unwrap_or(false);
        
        // If it's a root (no parent), it shouldn't have a prefix. The prefix goes to the sub.
        let actual_prefix = if parent_id.is_none() && !is_hybrid {
            None
        } else {
            req.code_prefix.clone()
        };

        if let Some(ref p) = actual_prefix {
            if !is_hybrid && p.chars().count() > 1 {
                return Err(AppError::Invalid("بادئة التصنيف العادي يجب أن تكون محرفاً واحداً فقط".into()));
            }
        }

        let category = MaterialCategory::new(
            req.name.clone(),
            parent_id,
            is_hybrid,
            actual_prefix,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&category).await?;

        // Auto-create default sub-category for new ROOT (non-hybrid) categories
        if category.parent_id.is_none() && !is_hybrid {
            let sub_name = category.default_sub_name();
            // Use the prefix from the request for the sub-category
            let sub = MaterialCategory::new(sub_name, Some(category.id.clone()), false, req.code_prefix)
                .map_err(|e| AppError::Invalid(e.to_string()))?;
            self.repo.save(&sub).await?;
        }

        Ok(CategoryDto::from(category))
    }

    pub async fn update(&self, req: UpdateCategoryRequest) -> Result<CategoryDto, AppError> {
        let cid = req
            .id
            .parse()
            .map_err(|_| AppError::NotFound("معرف التصنيف غير صالح".into()))?;
        let mut category = self
            .repo
            .find_by_id(&cid)
            .await?
            .ok_or_else(|| AppError::NotFound("التصنيف غير موجود".into()))?;

        // Protect default category from rename, but allow prefix change
        if category.is_default() {
            category.code_prefix = req.code_prefix;
            // Name must remain "Uncategorized"
            category.name = DEFAULT_CATEGORY_NAME.to_string();
        } else {
            category.name = req.name;
            category.parent_id = match req.parent_id {
                Some(pid) if !pid.is_empty() => Some(
                    pid.parse()
                        .map_err(|_| AppError::Invalid("معرف الأب غير صالح".into()))?,
                ),
                _ => None,
            };
            category.code_prefix = req.code_prefix;
        }

        if let Some(ref p) = category.code_prefix {
            if !category.is_hybrid && p.chars().count() > 1 {
                return Err(AppError::Invalid("بادئة التصنيف العادي يجب أن تكون محرفاً واحداً فقط".into()));
            }
        }

        if req.is_active {
            category.activate();
        } else {
            category.deactivate();
        }

        self.repo.update(&category).await?;
        Ok(CategoryDto::from(category))
    }

    pub async fn list_all(&self) -> Result<Vec<CategoryDto>, AppError> {
        let categories = self.repo.list_all().await?;
        let mut dtos = vec![];
        for cat in categories {
            let mut dto = CategoryDto::from(cat);
            if dto.name == DEFAULT_CATEGORY_NAME && (dto.code_prefix.is_none() || dto.code_prefix.as_ref().unwrap().is_empty()) {
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

    pub async fn delete(&self, id: String) -> Result<(), AppError> {
        let cid = id
            .parse()
            .map_err(|_| AppError::NotFound("معرف التصنيف غير صالح".into()))?;
        let category = self
            .repo
            .find_by_id(&cid)
            .await?
            .ok_or_else(|| AppError::NotFound("التصنيف غير موجود".into()))?;

        if category.is_default() {
            return Err(AppError::Forbidden(format!(
                "لا يمكن حذف التصنيف الافتراضي «{}»",
                DEFAULT_CATEGORY_NAME
            )));
        }

        let count = self.repo.count_materials_in_category(&cid).await?;
        if count > 0 {
            return Err(AppError::Forbidden(
                "لا يمكن حذف تصنيف يحتوي على مواد. يرجى نقل المواد أولاً.".into(),
            ));
        }

        self.repo.delete(&cid).await
    }

    pub async fn get_or_create_hybrid(&self, prefixes: Vec<String>) -> Result<CategoryDto, AppError> {
        if prefixes.is_empty() {
            return Err(AppError::Invalid("يجب توفر بادئة واحدة على الأقل".into()));
        }

        let mut sorted_prefixes = prefixes.clone();
        sorted_prefixes.sort();
        let hybrid_prefix = sorted_prefixes.join("");
        let hybrid_name = format!("هجين ({})", hybrid_prefix);

        // Check if exists
        let all = self.repo.list_all().await?;
        if let Some(existing) = all.iter().find(|c| c.is_hybrid && c.code_prefix == Some(hybrid_prefix.clone())) {
            return Ok(CategoryDto::from(existing.clone()));
        }

        // Create new
        let category = MaterialCategory {
            id: domain::shared::ids::MaterialCategoryId::new(),
            name: hybrid_name,
            parent_id: None,
            is_active: true,
            is_hybrid: true,
            code_prefix: Some(hybrid_prefix),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.repo.save(&category).await?;
        Ok(CategoryDto::from(category))
    }
}
