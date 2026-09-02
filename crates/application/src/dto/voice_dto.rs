use crate::dto::search_dto::{SearchDestinationDto, SearchResultDto};
use domain::shared::ExecutionContext;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VoiceIntentRequest {
    pub transcript: String,
    pub language: Option<String>,
    pub context: ExecutionContext,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VoiceCommandDto {
    pub action: String,
    pub route_id: Option<String>,
    pub entity_type: Option<String>,
    pub entity_query: Option<String>,
    pub command_id: Option<String>,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VoicePreviewDto {
    pub state: String,
    pub message: String,
    pub candidates: Vec<VoiceCommandDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VoiceExecutionResultDto {
    pub state: String,
    pub message: String,
    pub destination: Option<SearchDestinationDto>,
    pub results: Vec<SearchResultDto>,
}
