use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::opening_draft_repository::OpeningDraftRepository;

const MAX_DRAFT_BYTES: usize = 500_000;

pub struct GetOpeningDraftUseCase {
    repo: Arc<dyn OpeningDraftRepository>,
}

impl GetOpeningDraftUseCase {
    pub fn new(repo: Arc<dyn OpeningDraftRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Option<String>, AppError> {
        self.repo.get().await
    }
}

pub struct SaveOpeningDraftUseCase {
    repo: Arc<dyn OpeningDraftRepository>,
}

impl SaveOpeningDraftUseCase {
    pub fn new(repo: Arc<dyn OpeningDraftRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, data: &str) -> Result<(), AppError> {
        if data.len() > MAX_DRAFT_BYTES {
            return Err(AppError::Invalid(
                "مسودة الرصيد الافتتاحي كبيرة جداً — قلّص البيانات ثم أعد الحفظ".into(),
            ));
        }
        self.repo.save(data).await
    }
}

pub struct ClearOpeningDraftUseCase {
    repo: Arc<dyn OpeningDraftRepository>,
}

impl ClearOpeningDraftUseCase {
    pub fn new(repo: Arc<dyn OpeningDraftRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<(), AppError> {
        self.repo.clear().await
    }
}