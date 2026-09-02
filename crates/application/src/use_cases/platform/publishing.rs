use std::sync::Arc;

use crate::dto::platform_dto::PublishingProfilesDto;
use crate::errors::AppError;
use crate::ports::app_config_repository::AppConfigRepository;
use domain::settings::PublishingProfile;

const PUBLISHING_PROFILES_KEY: &str = "integration.publishing_profiles";

pub struct GetPublishingProfilesUseCase {
    config_repo: Arc<dyn AppConfigRepository>,
}

impl GetPublishingProfilesUseCase {
    pub fn new(config_repo: Arc<dyn AppConfigRepository>) -> Self {
        Self { config_repo }
    }

    pub async fn execute(&self) -> Result<PublishingProfilesDto, AppError> {
        let raw = self.config_repo.get(PUBLISHING_PROFILES_KEY).await?;
        let profiles = match raw {
            Some(value) => serde_json::from_str::<Vec<PublishingProfile>>(&value)
                .map_err(|e| AppError::Infrastructure(format!("publishing profiles parse: {e}")))?,
            None => Vec::new(),
        };
        Ok(PublishingProfilesDto { profiles })
    }
}

pub struct SavePublishingProfilesUseCase {
    config_repo: Arc<dyn AppConfigRepository>,
}

impl SavePublishingProfilesUseCase {
    pub fn new(config_repo: Arc<dyn AppConfigRepository>) -> Self {
        Self { config_repo }
    }

    pub async fn execute(
        &self,
        dto: PublishingProfilesDto,
    ) -> Result<PublishingProfilesDto, AppError> {
        let payload = serde_json::to_string(&dto.profiles)
            .map_err(|e| AppError::Infrastructure(format!("publishing profiles serialize: {e}")))?;
        self.config_repo
            .set(PUBLISHING_PROFILES_KEY, &payload)
            .await?;
        Ok(dto)
    }
}
