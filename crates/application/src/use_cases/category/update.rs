use crate::dto::category_dto::{CategoryDto, UpdateCategoryRequest};
use crate::errors::AppError;
use crate::ports::category_repository::CategoryRepository;
use domain::inventory::category::DEFAULT_CATEGORY_NAME;
use std::sync::Arc;

pub struct UpdateCategoryUseCase {
    repo: Arc<dyn CategoryRepository>,
}

impl UpdateCategoryUseCase {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: UpdateCategoryRequest) -> Result<CategoryDto, AppError> {
        let cid = req
            .id
            .parse()
            .map_err(|_| AppError::NotFound("معرف التصنيف غير صالح".into()))?;
        let mut category = self
            .repo
            .find_by_id(&cid)
            .await?
            .ok_or_else(|| AppError::NotFound("التصنيف غير موجود".into()))?;

        // Enforce unique names before mutating
        let all_cats = self.repo.list_all().await?;
        let trimmed = req.name.trim();
        if !category.is_default() && category.name != trimmed {
            if category.is_root() {
                if all_cats
                    .iter()
                    .any(|c| c.is_root() && c.name == trimmed && c.id != cid)
                {
                    return Err(AppError::Invalid(format!(
                        "يوجد تصنيف أساسي بنفس الاسم «{}»",
                        trimmed
                    )));
                }
            } else if all_cats
                .iter()
                .any(|c| c.parent_id == category.parent_id && c.name == trimmed && c.id != cid)
            {
                return Err(AppError::Invalid(format!(
                    "يوجد تصنيف فرعي بنفس الاسم «{}» ضمن نفس التصنيف الأساسي",
                    trimmed
                )));
            }
        }

        if category.is_default() {
            category.code_prefix = req.code_prefix;
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
                return Err(AppError::Invalid(
                    "بادئة التصنيف العادي يجب أن تكون محرفاً واحداً فقط".into(),
                ));
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
}
