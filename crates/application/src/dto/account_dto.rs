use serde::{Deserialize, Serialize};
use domain::accounting::account::Account;
use crate::use_cases::account::types::{AccountLedger, LedgerLine};

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
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountLedgerDto {
    pub account_id: String,
    pub account_name: String,
    pub opening_balance_syp: String,
    pub opening_balance_usd: String,
    pub lines: Vec<AccountLedgerLineDto>,
    pub total_debit_syp: String,
    pub total_credit_syp: String,
    pub closing_balance_syp: String,
    pub total_debit_usd: String,
    pub total_credit_usd: String,
    pub closing_balance_usd: String,
}

impl From<AccountLedger> for AccountLedgerDto {
    fn from(ledger: AccountLedger) -> Self {
        Self {
            account_id: ledger.account_id.0.to_string(),
            account_name: ledger.account_name,
            opening_balance_syp: ledger.opening_balance_syp.to_string(),
            opening_balance_usd: ledger.opening_balance_usd.to_string(),
            lines: ledger.lines.into_iter().map(AccountLedgerLineDto::from).collect(),
            total_debit_syp: ledger.total_debit_syp.to_string(),
            total_credit_syp: ledger.total_credit_syp.to_string(),
            closing_balance_syp: ledger.closing_balance_syp.to_string(),
            total_debit_usd: ledger.total_debit_usd.to_string(),
            total_credit_usd: ledger.total_credit_usd.to_string(),
            closing_balance_usd: ledger.closing_balance_usd.to_string(),
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
    pub debit_syp: String,
    pub credit_syp: String,
    pub balance_syp: String,
    pub debit_usd: String,
    pub credit_usd: String,
    pub balance_usd: String,
}

impl From<LedgerLine> for AccountLedgerLineDto {
    fn from(line: LedgerLine) -> Self {
        Self {
            date: line.date.to_rfc3339(),
            journal_id: line.journal_id.0.to_string(),
            entry_number: line.entry_number,
            journal_type: format!("{:?}", line.journal_type),
            source_id: line.source_id,
            description: line.description,
            opposite_account_name: line.opposite_account_name,
            currency: line.currency,
            fx_rate: line.fx_rate.to_string(),
            debit_syp: line.debit_syp.to_string(),
            credit_syp: line.credit_syp.to_string(),
            balance_syp: line.balance_syp.to_string(),
            debit_usd: line.debit_usd.to_string(),
            credit_usd: line.credit_usd.to_string(),
            balance_usd: line.balance_usd.to_string(),
        }
    }
}
