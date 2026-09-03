use domain::shared::ExecutionContext;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFiscalYearCommand {
    pub company_id: Option<String>,
    pub label: String,
    pub start_date: String,
    pub end_date: String,
    pub previous_fiscal_year_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseFiscalYearCommand {
    pub fiscal_year_id: String,
    pub closing_period_id: String,
    pub operation_key: String,
    pub finalize: bool,
    pub retained_earnings_entry_id: Option<String>,
    pub carry_forward_entry_id: Option<String>,
    pub context: ExecutionContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReopenFiscalYearCommand {
    pub fiscal_year_id: String,
    pub context: ExecutionContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalYearCloseRunDto {
    pub operation_key: String,
    pub actor_id: String,
    pub status: String,
    pub closing_period_id: Option<String>,
    pub retained_earnings_entry_id: Option<String>,
    pub carry_forward_entry_id: Option<String>,
    pub error_message: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalYearDto {
    pub id: String,
    pub company_id: Option<String>,
    pub label: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub previous_fiscal_year_id: Option<String>,
    pub closing_period_id: Option<String>,
    pub retained_earnings_entry_id: Option<String>,
    pub carry_forward_entry_id: Option<String>,
    pub last_close_operation_key: Option<String>,
    pub closed_at: Option<String>,
    pub closed_by: Option<String>,
    pub locked_at: Option<String>,
    pub locked_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub latest_close_run: Option<FiscalYearCloseRunDto>,
}
