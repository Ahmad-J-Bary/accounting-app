use domain::shared::ExecutionContext;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchDestinationDto {
    pub route_id: String,
    pub route_path: Option<String>,
    pub module_id: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchResultDto {
    pub id: String,
    pub result_type: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub provider: String,
    pub destination: SearchDestinationDto,
    pub permission_keys: Vec<String>,
    pub score: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchQueryRequest {
    pub query: String,
    pub limit: Option<usize>,
    pub entity_type: Option<String>,
    pub context: ExecutionContext,
}
