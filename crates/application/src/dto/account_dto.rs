use serde::{Deserialize, Serialize};
use domain::accounting::account::Account;

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountDto {
    pub id: String,
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub account_type: String,
    pub parent_id: Option<String>,
    pub balance: String,
    pub is_active: bool,
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
            balance: account.balance.to_string(),
            is_active: account.is_active,
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
