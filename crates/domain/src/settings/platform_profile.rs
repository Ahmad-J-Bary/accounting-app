use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct FeatureConfiguration {
    pub key: String,
    pub enabled: bool,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct TerminologyOverride {
    pub key: String,
    pub language: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct EditionProfile {
    pub edition_id: String,
    pub enabled_modules: Vec<String>,
    pub enabled_capabilities: Vec<String>,
    pub feature_flags: Vec<FeatureConfiguration>,
    pub terminology_overrides: Vec<TerminologyOverride>,
    pub default_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct PublishingProfile {
    pub id: String,
    pub provider: String,
    pub endpoint: String,
    pub enabled: bool,
    pub entity_types: Vec<String>,
    pub auth_config_key: Option<String>,
}
