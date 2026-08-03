use crate::use_cases::account::types::{AccountLedger, LedgerLine, LedgerOpeningInfo};
use domain::accounting::account::Account;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountDto {
    pub id: String,
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub account_type: String,
    pub parent_id: Option<String>,
    pub category: String,
    pub level: i32,
    pub opening_balance: String,
    pub balance: String,
    pub notes: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub is_final: bool,
    pub linked_customer_id: Option<String>,
    pub linked_supplier_id: Option<String>,
    pub debit: String,
    pub credit: String,
    pub currency: String,
    pub exchange_rate: String,
}

impl From<Account> for AccountDto {
    fn from(account: Account) -> Self {
        Self {
            id: account.id.0.to_string(),
            code: account.code,
            name_ar: account.name_ar,
            name_en: account.name_en,
            account_type: format!("{:?}", account.account_type),
            parent_id: account.parent_id.map(|id| id.0.to_string()),
            category: format!("{:?}", account.category),
            level: account.level,
            opening_balance: account.opening_balance.to_string(),
            balance: account.balance.to_string(),
            notes: account.notes,
            is_active: account.is_active,
            is_default: account.is_default,
            is_final: account.is_final,
            linked_customer_id: account.linked_customer_id.map(|id| id.0.to_string()),
            linked_supplier_id: account.linked_supplier_id.map(|id| id.0.to_string()),
            debit: account.debit.to_string(),
            credit: account.credit.to_string(),
            currency: account.currency.code,
            exchange_rate: account.exchange_rate.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountLedgerDto {
    pub account_id: String,
    pub account_name: String,
    pub opening_balance_base: String,
    pub opening_balance_original: String,
    pub opening_entry: Option<OpeningEntryDto>,
    pub opening_entries: Vec<OpeningEntryDto>,
    pub lines: Vec<AccountLedgerLineDto>,
    pub total_debit_base: String,
    pub total_credit_base: String,
    pub closing_balance_base: String,
    pub total_debit_original: String,
    pub total_credit_original: String,
    pub closing_balance_original: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpeningEntryDto {
    pub entry_number: String,
    pub description: String,
    pub date: String,
    pub debit_base: String,
    pub credit_base: String,
}

impl From<LedgerOpeningInfo> for OpeningEntryDto {
    fn from(info: LedgerOpeningInfo) -> Self {
        Self {
            entry_number: info.entry_number,
            description: info.description,
            date: info.date.to_rfc3339(),
            debit_base: info.debit_base.to_string(),
            credit_base: info.credit_base.to_string(),
        }
    }
}

impl From<AccountLedger> for AccountLedgerDto {
    fn from(ledger: AccountLedger) -> Self {
        Self {
            account_id: ledger.account_id.0.to_string(),
            account_name: ledger.account_name,
            opening_balance_base: ledger.opening_balance_base.to_string(),
            opening_balance_original: ledger.opening_balance_original.to_string(),
            opening_entry: ledger.opening_entry.map(OpeningEntryDto::from),
            opening_entries: ledger
                .opening_entries
                .into_iter()
                .map(OpeningEntryDto::from)
                .collect(),
            lines: ledger
                .lines
                .into_iter()
                .map(AccountLedgerLineDto::from)
                .collect(),
            total_debit_base: ledger.total_debit_base.to_string(),
            total_credit_base: ledger.total_credit_base.to_string(),
            closing_balance_base: ledger.closing_balance_base.to_string(),
            total_debit_original: ledger.total_debit_original.to_string(),
            total_credit_original: ledger.total_credit_original.to_string(),
            closing_balance_original: ledger.closing_balance_original.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountLedgerLineDto {
    pub date: String,
    pub journal_id: String,
    pub entry_number: String,
    pub journal_type: String,
    pub source_id: Option<String>,
    pub description: String,
    pub opposite_account_name: String,
    pub currency: String,
    pub fx_rate: String,
    pub debit_base: String,
    pub credit_base: String,
    pub balance_base: String,
    pub debit_original: String,
    pub credit_original: String,
    pub balance_original: String,
}

impl From<LedgerLine> for AccountLedgerLineDto {
    fn from(line: LedgerLine) -> Self {
        Self {
            date: line.date.to_rfc3339(),
            journal_id: line.journal_id.0.to_string(),
            entry_number: line.entry_number,
            journal_type: line.journal_type.to_string(),
            source_id: line.source_id,
            description: line.description,
            opposite_account_name: line.opposite_account_name,
            currency: line.currency,
            fx_rate: line.fx_rate.to_string(),
            debit_base: line.debit_base.to_string(),
            credit_base: line.credit_base.to_string(),
            balance_base: line.balance_base.to_string(),
            debit_original: line.debit_original.to_string(),
            credit_original: line.credit_original.to_string(),
            balance_original: line.balance_original.to_string(),
        }
    }
}
