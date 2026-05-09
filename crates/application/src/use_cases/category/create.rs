use std::sync::Arc;
use domain::inventory::category::{MaterialCategory, DEFAULT_CATEGORY_NAME};
use crate::ports::category_repository::CategoryRepository;
use crate::dto::category_dto::{CategoryDto, CreateCategoryRequest};
use crate::errors::AppError;

pub struct CreateCategoryUseCase {
    repo: Arc<dyn CategoryRepository>,
}

impl CreateCategoryUseCase {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateCategoryRequest) -> Result<CategoryDto, AppError> {
        let parent_id = match &req.parent_id {
            Some(pid) if !pid.is_empty() => Some(
                pid.parse()
                    .map_err(|_| AppError::Invalid("معرف الأب غير صالح".into()))?,
            ),
            _ => None,
        };

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

        if category.parent_id.is_none() && !is_hybrid {
            let sub_name = category.default_sub_name();
            let sub = MaterialCategory::new(sub_name, Some(category.id), false, req.code_prefix)
                .map_err(|e| AppError::Invalid(e.to_string()))?;
            self.repo.save(&sub).await?;
        }

        Ok(CategoryDto::from(category))
    }
}
