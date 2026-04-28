use serde::{Deserialize, Serialize};
use domain::accounting::account::{AccountType, AccountCategory};
use domain::shared::ids::AccountId;

#[derive(Debug, Deserialize, Clone)]
pub struct CreateAccountCommand {
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub account_type: AccountType,
    pub parent_id: Option<AccountId>,
    pub category: AccountCategory,
    pub level: i32,
    pub opening_balance: String,
    pub notes: Option<String>,
    pub linked_customer_id: Option<String>,
    pub linked_supplier_id: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub debit: Option<String>,
    pub credit: Option<String>,
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AccountLedger {
    pub account_id: AccountId,
    pub account_name: String,
    pub opening_balance: rust_decimal::Decimal,
    pub lines: Vec<LedgerLine>,
    pub total_debit: rust_decimal::Decimal,
    pub total_credit: rust_decimal::Decimal,
    pub closing_balance: rust_decimal::Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct LedgerLine {
    pub date: chrono::DateTime<chrono::Utc>,
    pub journal_id: domain::shared::ids::JournalEntryId,
    pub description: String,
    pub debit: rust_decimal::Decimal,
    pub credit: rust_decimal::Decimal,
    pub balance: rust_decimal::Decimal,
}
