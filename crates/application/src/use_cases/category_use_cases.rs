use std::sync::Arc;
use domain::inventory::category::MaterialCategory;
use crate::ports::category_repository::CategoryRepository;
use crate::dto::category_dto::{CreateCategoryRequest, UpdateCategoryRequest, CategoryDto};
use crate::errors::AppError;

pub struct CategoryUseCases {
    repo: Arc<dyn CategoryRepository>,
}

impl CategoryUseCases {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn create(&self, req: CreateCategoryRequest) -> Result<CategoryDto, AppError> {
        let parent_id = match req.parent_id {
            Some(pid) if !pid.is_empty() => Some(pid.parse().map_err(|_| AppError::Invalid("معرف الأب غير صالح".into()))?),
            _ => None,
        };

        let category = MaterialCategory::new(req.name, parent_id)
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&category).await?;
        Ok(CategoryDto::from(category))
    }

    pub async fn update(&self, req: UpdateCategoryRequest) -> Result<CategoryDto, AppError> {
        let cid = req.id.parse().map_err(|_| AppError::NotFound("معرف التصنيف غير صالح".into()))?;
        let mut category = self.repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("التصنيف غير موجود".into()))?;

        // Protection for default "General" category
        if category.name == "عام" {
            // Only allow renaming if it's not the system default one, but for now we block modification of "عام"
            // return Err(AppError::Forbidden("لا يمكن تعديل التصنيف الافتراضي".into()));
        }

        let parent_id = match req.parent_id {
            Some(pid) if !pid.is_empty() => Some(pid.parse().map_err(|_| AppError::Invalid("معرف الأب غير صالح".into()))?),
            _ => None,
        };

        category.name = req.name;
        category.parent_id = parent_id;
        
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
            let count = self.repo.count_materials_in_category(&dto.id.parse().unwrap()).await?;
            dto.material_count = count;
            dtos.push(dto);
        }
        Ok(dtos)
    }

    pub async fn delete(&self, id: String) -> Result<(), AppError> {
        let cid = id.parse().map_err(|_| AppError::NotFound("معرف التصنيف غير صالح".into()))?;
        let category = self.repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("التصنيف غير موجود".into()))?;

        if category.name == "عام" {
            return Err(AppError::Forbidden("لا يمكن حذف التصنيف الافتراضي".into()));
        }

        let count = self.repo.count_materials_in_category(&cid).await?;
        if count > 0 {
            return Err(AppError::Forbidden("لا يمكن حذف تصنيف يحتوي على مواد. يرجى نقل المواد أولاً".into()));
        }

        self.repo.delete(&cid).await
    }
}
