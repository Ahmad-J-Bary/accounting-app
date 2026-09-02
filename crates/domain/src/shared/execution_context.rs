use serde::{Deserialize, Serialize};

/// Request-scoped execution context shared by application commands, search,
/// voice, publishing, and future multi-window flows. This is operational
/// context, not business truth.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct ExecutionContext {
    pub actor_id: Option<String>,
    pub company_id: Option<String>,
    pub active_fiscal_period_id: Option<String>,
    pub active_fiscal_year_id: Option<String>,
    pub language: Option<String>,
    pub window_id: Option<String>,
    pub request_id: Option<String>,
    pub permission_keys: Vec<String>,
    pub capability_keys: Vec<String>,
}

impl ExecutionContext {
    pub fn has_permission(&self, permission_key: &str) -> bool {
        self.permission_keys
            .iter()
            .any(|item| item == permission_key)
    }

    pub fn has_capability(&self, capability_key: &str) -> bool {
        self.capability_keys
            .iter()
            .any(|item| item == capability_key)
    }
}
