use crate::errors::AppError;
use crate::ports::category_repository::CategoryRepository;
use domain::inventory::category::{MaterialCategory, DEFAULT_CATEGORY_NAME};
use domain::shared::ids::MaterialCategoryId;
use std::sync::Arc;

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

/// Result returned by [`DeleteCategoryCascadeUseCase`].
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct DeleteCategoryCascadeResult {
    /// Number of material_category rows reassigned away from the deleted
    /// categories (i.e. materials that were moved to a fallback category).
    pub materials_reassigned: u64,
    /// Number of sub-categories that were deleted (only non-zero when the
    /// target category was a root).
    pub subs_deleted: u64,
}

/// Deletes a category while reassigning its materials to a fallback category.
///
/// When the target is a root, every sub-category under it is also deleted —
/// the materials in those subs are reassigned to the same fallback before
/// removal. When the target is a sub, only that sub is deleted.
pub struct DeleteCategoryCascadeUseCase {
    repo: Arc<dyn CategoryRepository>,
}

impl DeleteCategoryCascadeUseCase {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(
        &self,
        id: String,
        reassign_materials_to: String,
    ) -> Result<DeleteCategoryCascadeResult, AppError> {
        let cid: MaterialCategoryId = id
            .parse()
            .map_err(|_| AppError::Invalid("معرف التصنيف غير صالح".into()))?;
        let target: MaterialCategoryId = reassign_materials_to
            .parse()
            .map_err(|_| AppError::Invalid("معرف التصنيف الهدف غير صالح".into()))?;

        if cid == target {
            return Err(AppError::Invalid(
                "لا يمكن إعادة إسناد مواد التصنيف إلى نفسه".into(),
            ));
        }

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

        let target_cat = self
            .repo
            .find_by_id(&target)
            .await?
            .ok_or_else(|| AppError::NotFound("التصنيف الهدف غير موجود".into()))?;
        if !target_cat.is_active {
            return Err(AppError::Invalid("التصنيف الهدف غير نشط".into()));
        }

        // For a root we also need to find its sub-categories.
        let subs: Vec<MaterialCategory> = if category.parent_id.is_none() {
            self.repo
                .list_all()
                .await?
                .into_iter()
                .filter(|c| c.parent_id.as_ref() == Some(&cid))
                .collect()
        } else {
            vec![]
        };

        let mut total_reassigned: u64 = 0;
        let mut subs_deleted: u64 = 0;

        if category.parent_id.is_none() {
            // Cascade: for each sub, move its materials to the fallback then delete it.
            for sub in &subs {
                let moved = self.repo.reassign_materials(&sub.id, &target).await?;
                total_reassigned += moved;
                self.repo.delete(&sub.id).await?;
                subs_deleted += 1;
            }
            // Also move the root's own materials (rare, but safe).
            let moved = self.repo.reassign_materials(&cid, &target).await?;
            total_reassigned += moved;
            self.repo.delete(&cid).await?;
        } else {
            // Sub: move materials to fallback, then delete the sub.
            let moved = self.repo.reassign_materials(&cid, &target).await?;
            total_reassigned += moved;
            self.repo.delete(&cid).await?;
        }

        Ok(DeleteCategoryCascadeResult {
            materials_reassigned: total_reassigned,
            subs_deleted,
        })
    }
}
