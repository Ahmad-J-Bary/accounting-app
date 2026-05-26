use domain::accounting::account::{AccountCategory, AccountType};
use domain::shared::ids::AccountId;
use serde::{Deserialize, Serialize};

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
    pub exchange_rate: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AccountLedger {
    pub account_id: AccountId,
    pub account_name: String,

    pub opening_balance_base: rust_decimal::Decimal,
    pub opening_balance_original: rust_decimal::Decimal,

    pub lines: Vec<LedgerLine>,

    pub total_debit_base: rust_decimal::Decimal,
    pub total_credit_base: rust_decimal::Decimal,
    pub closing_balance_base: rust_decimal::Decimal,

    pub total_debit_original: rust_decimal::Decimal,
    pub total_credit_original: rust_decimal::Decimal,
    pub closing_balance_original: rust_decimal::Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct LedgerLine {
    pub date: chrono::DateTime<chrono::Utc>,
    pub journal_id: domain::shared::ids::JournalEntryId,
    pub entry_number: String,
    pub journal_type: domain::accounting::JournalType,
    pub source_id: Option<String>,
    pub description: String,
    pub opposite_account_name: String,
    pub currency: String,
    pub fx_rate: rust_decimal::Decimal,

    pub debit_base: rust_decimal::Decimal,
    pub credit_base: rust_decimal::Decimal,
    pub balance_base: rust_decimal::Decimal,

    pub debit_original: rust_decimal::Decimal,
    pub credit_original: rust_decimal::Decimal,
    pub balance_original: rust_decimal::Decimal,
}
