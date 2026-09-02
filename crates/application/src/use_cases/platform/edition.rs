use std::sync::Arc;

use crate::dto::platform_dto::PlatformProfileDto;
use crate::errors::AppError;
use crate::ports::app_config_repository::AppConfigRepository;
use domain::settings::EditionProfile;

const EDITION_PROFILE_KEY: &str = "platform.edition_profile";

pub struct GetEditionProfileUseCase {
    config_repo: Arc<dyn AppConfigRepository>,
}

impl GetEditionProfileUseCase {
    pub fn new(config_repo: Arc<dyn AppConfigRepository>) -> Self {
        Self { config_repo }
    }

    pub async fn execute(&self) -> Result<PlatformProfileDto, AppError> {
        let raw = self.config_repo.get(EDITION_PROFILE_KEY).await?;
        let edition = match raw {
            Some(value) => serde_json::from_str::<EditionProfile>(&value)
                .map_err(|e| AppError::Infrastructure(format!("edition profile parse: {e}")))?,
            None => EditionProfile::default(),
        };
        Ok(PlatformProfileDto { edition })
    }
}

pub struct SaveEditionProfileUseCase {
    config_repo: Arc<dyn AppConfigRepository>,
}

impl SaveEditionProfileUseCase {
    pub fn new(config_repo: Arc<dyn AppConfigRepository>) -> Self {
        Self { config_repo }
    }

    pub async fn execute(&self, dto: PlatformProfileDto) -> Result<PlatformProfileDto, AppError> {
        let payload = serde_json::to_string(&dto.edition)
            .map_err(|e| AppError::Infrastructure(format!("edition profile serialize: {e}")))?;
        self.config_repo.set(EDITION_PROFILE_KEY, &payload).await?;
        Ok(dto)
    }
}
