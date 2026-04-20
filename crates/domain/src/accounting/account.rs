use crate::shared::errors::DomainError;
use crate::shared::ids::AccountId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccountType {
    Assets,          // الأصول
    Liabilities,     // الالتزامات
    Equity,          // حقوق الملكية
    Revenue,         // الإيرادات
    Expenses,        // المصاريف
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: AccountId,
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub account_type: AccountType,
    pub parent_id: Option<AccountId>,
    pub balance: Decimal,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Account {
    pub fn new(
        code: String,
        name_ar: String,
        name_en: String,
        account_type: AccountType,
        parent_id: Option<AccountId>,
    ) -> Result<Self, DomainError> {
        if code.trim().is_empty() {
            return Err(DomainError::Invalid("كود الحساب لا يمكن أن يكون فارغًا".into()));
        }

        if name_ar.trim().is_empty() {
            return Err(DomainError::Invalid("اسم الحساب بالعربية لا يمكن أن يكون فارغًا".into()));
        }

        if name_en.trim().is_empty() {
            return Err(DomainError::Invalid("اسم الحساب بالإنجليزية لا يمكن أن يكون فارغًا".into()));
        }

        let now = Utc::now();

        Ok(Self {
            id: AccountId(Uuid::new_v4()),
            code,
            name_ar,
            name_en,
            account_type,
            parent_id,
            balance: Decimal::ZERO,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn debit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ المدين يجب أن يكون موجبًا".into()));
        }

        self.balance += amount;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn credit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدائن يجب أن يكون موجبًا".into()));
        }

        self.balance -= amount;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn is_debit_account(&self) -> bool {
        matches!(
            self.account_type,
            AccountType::Assets | AccountType::Expenses
        )
    }

    pub fn is_credit_account(&self) -> bool {
        matches!(
            self.account_type,
            AccountType::Liabilities | AccountType::Equity | AccountType::Revenue
        )
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn account_creation_with_valid_data_succeeds() {
        let result = Account::new(
            "1001".to_string(),
            "النقدية".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        );

        assert!(result.is_ok());
        let account = result.unwrap();
        assert_eq!(account.code, "1001");
        assert_eq!(account.name_ar, "النقدية");
        assert_eq!(account.balance, Decimal::ZERO);
    }

    #[test]
    fn account_code_cannot_be_empty() {
        let result = Account::new(
            "".to_string(),
            "النقدية".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        );

        assert!(result.is_err());
    }

    #[test]
    fn account_name_ar_cannot_be_empty() {
        let result = Account::new(
            "1001".to_string(),
            "".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        );

        assert!(result.is_err());
    }

    #[test]
    fn debit_increases_balance() {
        let mut account = Account::new(
            "1001".to_string(),
            "النقدية".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        ).unwrap();

        account.debit(dec!(100)).unwrap();
        assert_eq!(account.balance, dec!(100));
    }

    #[test]
    fn credit_decreases_balance() {
        let mut account = Account::new(
            "1001".to_string(),
            "النقدية".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        ).unwrap();

        account.debit(dec!(100)).unwrap();
        account.credit(dec!(50)).unwrap();
        assert_eq!(account.balance, dec!(50));
    }

    #[test]
    fn negative_debit_is_rejected() {
        let mut account = Account::new(
            "1001".to_string(),
            "النقدية".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        ).unwrap();

        let result = account.debit(dec!(-10));
        assert!(result.is_err());
    }

    #[test]
    fn negative_credit_is_rejected() {
        let mut account = Account::new(
            "1001".to_string(),
            "النقدية".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        ).unwrap();

        let result = account.credit(dec!(-10));
        assert!(result.is_err());
    }

    #[test]
    fn assets_account_is_debit_account() {
        let account = Account::new(
            "1001".to_string(),
            "النقدية".to_string(),
            "Cash".to_string(),
            AccountType::Assets,
            None,
        ).unwrap();

        assert!(account.is_debit_account());
    }

    #[test]
    fn expenses_account_is_debit_account() {
        let account = Account::new(
            "5001".to_string(),
            "المصاريف".to_string(),
            "Expenses".to_string(),
            AccountType::Expenses,
            None,
        ).unwrap();

        assert!(account.is_debit_account());
    }

    #[test]
    fn liabilities_account_is_credit_account() {
        let account = Account::new(
            "2001".to_string(),
            "الدائنون".to_string(),
            "Creditors".to_string(),
            AccountType::Liabilities,
            None,
        ).unwrap();

        assert!(account.is_credit_account());
    }

    #[test]
    fn equity_account_is_credit_account() {
        let account = Account::new(
            "3001".to_string(),
            "رأس المال".to_string(),
            "Capital".to_string(),
            AccountType::Equity,
            None,
        ).unwrap();

        assert!(account.is_credit_account());
    }

    #[test]
    fn revenue_account_is_credit_account() {
        let account = Account::new(
            "4001".to_string(),
            "المبيعات".to_string(),
            "Sales".to_string(),
            AccountType::Revenue,
            None,
        ).unwrap();

        assert!(account.is_credit_account());
    }
}
