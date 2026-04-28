use std::sync::Arc;
use domain::inventory::category::{DEFAULT_CATEGORY_NAME};
use crate::ports::category_repository::CategoryRepository;
use crate::errors::AppError;

pub struct DeleteCategoryUseCase {
    repo: Arc<dyn CategoryRepository>,
}

impl DeleteCategoryUseCase {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
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
}
