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
    pub lines: Vec<AccountLedgerLineDto>,
    pub total_debit: String,
    pub total_credit: String,
    pub final_balance: String,
}

impl From<AccountLedger> for AccountLedgerDto {
    fn from(ledger: AccountLedger) -> Self {
        Self {
            account_id: ledger.account_id.0.to_string(),
            account_name: ledger.account_name,
            lines: ledger.lines.into_iter().map(AccountLedgerLineDto::from).collect(),
            total_debit: ledger.total_debit.to_string(),
            total_credit: ledger.total_credit.to_string(),
            final_balance: ledger.closing_balance.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountLedgerLineDto {
    pub date: String,
    pub journal_id: String,
    pub description: String,
    pub currency: String,
    pub fx_rate: String,
    pub debit: String,
    pub credit: String,
    pub base_debit: String,
    pub base_credit: String,
    pub running_balance: String,
}

impl From<LedgerLine> for AccountLedgerLineDto {
    fn from(line: LedgerLine) -> Self {
        Self {
            date: line.date.to_rfc3339(),
            journal_id: line.journal_id.0.to_string(),
            description: line.description,
            currency: "SYP".to_string(), // Default since it's base balance calculation
            fx_rate: "1".to_string(),
            debit: line.debit.to_string(),
            credit: line.credit.to_string(),
            base_debit: line.debit.to_string(),
            base_credit: line.credit.to_string(),
            running_balance: line.balance.to_string(),
        }
    }
}
