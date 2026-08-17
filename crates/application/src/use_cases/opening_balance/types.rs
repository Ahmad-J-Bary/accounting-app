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
pub struct UpdateOpeningMigrationLinesCommand {
    pub migration_id: String,
    pub cutover_date: String,
    pub notes: Option<String>,
    pub lines: Vec<OpeningLineInput>,
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

// ---------- Opening sub-ledger items (link to REAL entities) ----------
// A migration's sub-ledger is a list of references to real entities
// (Customer / Supplier / Material / FixedAsset) with the opening amount each
// carries. The parallel "Opening Customer" style stores no longer exist: the
// entity is created through the same module, and the opening amount is an
// Accounting Movement attached to it inside the migration context.

/// Canonical kinds matching `SubledgerKind::key()`.
pub const KIND_AR: &str = "AR";
pub const KIND_AP: &str = "AP";
pub const KIND_INVENTORY: &str = "Inventory";
pub const KIND_FIXED_ASSET: &str = "FixedAsset";
pub const KIND_BANK: &str = "Bank";
pub const KIND_LOAN: &str = "Loan";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OpeningItemInput {
    pub kind: String,          // KIND_AR | KIND_AP | KIND_INVENTORY | KIND_FIXED_ASSET | KIND_BANK | KIND_LOAN
    pub entity_id: String,     // real customer/supplier/material/asset id or ledger AccountId for bank/loan
    pub reference: Option<String>,
    pub amount: String,        // AR/AP net balance, inventory total cost, FA net book value, bank/loan balance
    pub qty: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaveOpeningItemsCommand {
    pub migration_id: String,
    pub items: Vec<OpeningItemInput>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct OpeningItemsDto {
    pub items: Vec<OpeningItemInput>,
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
pub struct ResidualDesignatedAccountDto {
    pub id: String,
    pub code: String,
    pub name_ar: String,
}

/// Read-only specification of one residual classification — the contract that
/// keeps the "user picks meaning, system picks the account" rule in ONE place:
/// the frontend renders options, the Advanced-mode account filter and the post
/// preview from this spec; the domain/use-case validation enforces it.
#[derive(Debug, Clone, Serialize)]
pub struct ResidualClassificationSpec {
    pub key: String,
    pub label_ar: String,
    pub allows_posting: bool,
    pub requires_confirmation: bool,
    /// Account purposes the classification may target (exactly one for real
    /// classifications; empty for UnresolvedDifference).
    pub allowed_purposes: Vec<String>,
    /// The designated account the system would resolve for the classification
    /// (None when no designated account exists in the chart, or for
    /// UnresolvedDifference).
    pub designated_account: Option<ResidualDesignatedAccountDto>,
    /// Plain-Arabic treatment/preview copy shown before posting.
    pub treatment_ar: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReconciliationRow {
    pub key: String,
    pub subledger: Decimal,
    pub general_ledger: Decimal,
    pub reconciled: bool,
}