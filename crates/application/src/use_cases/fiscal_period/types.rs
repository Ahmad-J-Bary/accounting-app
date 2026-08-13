use serde::{Deserialize, Serialize};

pub const AUTH_ALLOCATION_SOURCE_PREFIX: &str = "profit_distribution:";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFiscalPeriodCommand {
    pub company_id: Option<String>,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseFiscalPeriodCommand {
    pub period_id: String,
    pub closed_by: String,
    /// "Closed" to finalize immediately, "Closing" to run the closing checks
    /// and leave the period in the intermediate state.
    pub finalize: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockFiscalPeriodCommand {
    pub period_id: String,
    pub locked_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReopenFiscalPeriodCommand {
    pub period_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputePeriodProfitCommand {
    pub company_id: Option<String>,
    pub period_start: String,
    pub period_end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputedPeriodProfitDto {
    pub net_profit: String,
    pub total_revenue: String,
    pub total_expenses: String,
    pub entry_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributableProfitDto {
    pub period_id: Option<String>,
    /// Ledger current-period profit for the given window (revenue − expenses,
    /// posted journals only).
    pub current_period_profit: String,
    /// Balance of the retained-earnings account (purpose=RetainedEarnings),
    /// i.e. historical/accumulated result booked in the chart.
    pub retained_earnings_balance: String,
    /// Total already allocated to partners via `profit_distribution:*` source
    /// journals (idempotency-safe: counts only the posted allocation).
    pub allocated_to_date: String,
    /// distributable = current_period_profit + retained_earnings − allocated.
    pub distributable: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalPeriodDto {
    pub id: String,
    pub company_id: Option<String>,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub closed_at: Option<String>,
    pub closed_by: Option<String>,
    pub locked_at: Option<String>,
    pub locked_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}