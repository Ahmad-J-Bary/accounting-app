use serde::{Deserialize, Serialize};

// Trial Balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrialBalanceLineDto {
    pub account_id: String,
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub debit_total: String,
    pub credit_total: String,
    pub balance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrialBalanceDto {
    pub lines: Vec<TrialBalanceLineDto>,
    pub total_debit: String,
    pub total_credit: String,
    pub generated_at: String,
}

// Profit & Loss
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfitLossLineDto {
    pub account_name: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfitLossDto {
    pub revenue_lines: Vec<ProfitLossLineDto>,
    pub expense_lines: Vec<ProfitLossLineDto>,
    pub total_revenue: String,
    pub total_expenses: String,
    pub net_profit: String,
    pub period_start: String,
    pub period_end: String,
}

// Balance Sheet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceSheetDto {
    pub assets: Vec<ProfitLossLineDto>,
    pub liabilities: Vec<ProfitLossLineDto>,
    pub equity: Vec<ProfitLossLineDto>,
    pub total_assets: String,
    pub total_liabilities: String,
    pub total_equity: String,
    pub as_of_date: String,
}

// Receivables/Payables Aging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgingLineDto {
    pub party_id: String,
    pub party_name: String,
    pub balance: String,
    pub current: String,
    pub days_30: String,
    pub days_60: String,
    pub days_90_plus: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgingReportDto {
    pub lines: Vec<AgingLineDto>,
    pub total_balance: String,
    pub as_of_date: String,
}

// Inventory Valuation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryValuationLineDto {
    pub product_id: String,
    pub product_code: String,
    pub product_name: String,
    pub quantity: String,
    pub unit_cost: String,
    pub total_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryValuationDto {
    pub lines: Vec<InventoryValuationLineDto>,
    pub total_value: String,
    pub generated_at: String,
}

// Sales Report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesReportDto {
    pub total_invoices: u32,
    pub total_sales: String,
    pub total_tax: String,
    pub total_discount: String,
    pub net_sales: String,
    pub period_start: String,
    pub period_end: String,
}
