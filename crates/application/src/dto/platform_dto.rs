use domain::settings::{EditionProfile, PublishingProfile};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct PlatformProfileDto {
    pub edition: EditionProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct PublishingProfilesDto {
    pub profiles: Vec<PublishingProfile>,
}
