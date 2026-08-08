use domain::accounting::OpeningBalanceMigration;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone)]
pub struct OpeningLineInput {
    pub account_id: String,
    pub amount: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CreateOpeningBalanceMigrationCommand {
    pub cutover_date: String,
    pub notes: Option<String>,
    pub lines: Vec<OpeningLineInput>,
    /// Prior accounting system this migration replaces (Sec 31 traceability).
    pub source_system: Option<String>,
    pub source_reference: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SetResidualClassificationCommand {
    pub migration_id: String,
    pub classification: String,
    /// Ledger account carrying the residual (e.g. 52 retained earnings).
    pub residual_account_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OpeningMigrationDto(pub OpeningBalanceMigration);

#[derive(Debug, Serialize)]
pub struct PostOpeningBalanceResult {
    pub migration: OpeningMigrationDto,
    pub debit_total: Decimal,
    pub credit_total: Decimal,
    pub equity_balanced: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AllocateNetProfitCommand {
    pub migration_id: String,
    pub net_profit: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ComputeNetProfitCommand {
    /// The migration whose cutover date bounds the ledger window for the
    /// computation (only posted entries at or before it are included).
    pub migration_id: String,
    /// Optional explicit period window. When provided, `period_start` and
    /// `period_end` take precedence over the migration's cutover date so the
    /// net profit can be computed for an arbitrary fiscal period (Sec 45).
    pub period_start: Option<String>,
    pub period_end: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ComputedNetProfitDto {
    pub net_profit: Decimal,
    pub total_revenue: Decimal,
    pub total_expenses: Decimal,
    pub entry_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PartnerAllocationShare {
    pub partner_id: String,
    pub partner_name: String,
    pub capital: Decimal,
    pub ratio_percent: Decimal,
    pub share: Decimal,
}

#[derive(Debug, Serialize)]
pub struct NetProfitAllocationDto {
    pub entry_number: String,
    pub net_profit: Decimal,
    pub allocated_total: Decimal,
    pub shares: Vec<PartnerAllocationShare>,
}

// ---------- Opening detail items (AR / AP / Inventory / Fixed Assets) ----------

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OpeningCustomerItem {
    pub customer_id: String,
    pub reference: Option<String>,
    pub original_amount: String,
    pub outstanding_amount: String,
    pub due_date: Option<String>,
    pub currency_code: Option<String>,
    pub exchange_rate: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OpeningSupplierItem {
    pub supplier_id: String,
    pub reference: Option<String>,
    pub original_amount: String,
    pub outstanding_amount: String,
    pub due_date: Option<String>,
    pub currency_code: Option<String>,
    pub exchange_rate: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OpeningInventoryItem {
    pub material_id: String,
    pub warehouse_id: Option<String>,
    pub quantity: String,
    pub unit_cost: String,
    pub total_cost: String,
    pub batch: Option<String>,
    pub currency_code: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OpeningFixedAssetItem {
    pub asset_id: String,
    pub acquisition_cost: String,
    pub accumulated_depreciation: String,
    pub net_book_value: String,
    pub acquisition_date: Option<String>,
    pub depreciation_method: Option<String>,
    pub useful_life: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaveOpeningDetailsCommand {
    pub migration_id: String,
    pub customer_items: Vec<OpeningCustomerItem>,
    pub supplier_items: Vec<OpeningSupplierItem>,
    pub inventory_items: Vec<OpeningInventoryItem>,
    pub fixed_assets: Vec<OpeningFixedAssetItem>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct OpeningDetailsDto {
    pub customer_items: Vec<OpeningCustomerItem>,
    pub supplier_items: Vec<OpeningSupplierItem>,
    pub inventory_items: Vec<OpeningInventoryItem>,
    pub fixed_assets: Vec<OpeningFixedAssetItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpeningReconciliationDto {
    pub rows: Vec<ReconciliationRow>,
    pub all_reconciled: bool,
    pub opening_control_balance: Decimal,
    pub debit_total: Decimal,
    pub credit_total: Decimal,
    pub debit_equals_credit: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReconciliationRow {
    pub key: String,
    pub subledger: Decimal,
    pub general_ledger: Decimal,
    pub reconciled: bool,
}