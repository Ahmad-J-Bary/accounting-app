#![allow(clippy::too_many_arguments)]
use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, CustomerId, SupplierId};
use crate::shared::currency::Currency;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AccountType {
    Assets,      // الأصول
    Liabilities, // الالتزامات
    Equity,      // حقوق الملكية
    Revenue,     // الإيرادات
    Expenses,    // المصاريف
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum AccountCategory {
    Summary, // حساب تجميعي
    Detail,  // حساب فرعي/نهائي
}

/// The side on which an account normally carries its balance and increases.
/// Assets & Expenses are debit-normal; Liabilities, Equity and Revenue are
/// credit-normal. Used to interpret a stored balance as a signed value.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum NormalBalance {
    Debit,
    Credit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: AccountId,
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub account_type: AccountType,
    pub parent_id: Option<AccountId>,
    pub category: AccountCategory,
    pub level: i32,
    pub opening_balance: Decimal,
    pub balance: Decimal,
    pub notes: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub is_final: bool,
    pub linked_customer_id: Option<CustomerId>,
    pub linked_supplier_id: Option<SupplierId>,
    pub debit: Decimal,
    pub credit: Decimal,
    pub currency: Currency,
    pub exchange_rate: Decimal,
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
        category: AccountCategory,
        level: i32,
        opening_balance: Decimal,
        debit: Decimal,
        credit: Decimal,
        currency: Currency,
        exchange_rate: Decimal,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if code.trim().is_empty() {
            return Err(DomainError::Invalid(
                "كود الحساب لا يمكن أن يكون فارغًا".into(),
            ));
        }

        if name_ar.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم الحساب بالعربية لا يمكن أن يكون فارغًا".into(),
            ));
        }

        if name_en.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم الحساب بالإنجليزية لا يمكن أن يكون فارغًا".into(),
            ));
        }

        if level < 1 {
            return Err(DomainError::Invalid(
                "مستوى الحساب يجب أن يكون 1 أو أكبر".into(),
            ));
        }

        let now = Utc::now();
        let balance = opening_balance + debit - credit;

        Ok(Self {
            id: AccountId(Uuid::new_v4()),
            code,
            name_ar,
            name_en,
            account_type,
            parent_id,
            category,
            level,
            opening_balance,
            balance,
            debit,
            credit,
            currency,
            exchange_rate,
            notes,
            is_active: true,
            is_default: false,
            is_final: false,
            linked_customer_id: None,
            linked_supplier_id: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn set_final(&mut self, is_final: bool) {
        self.is_final = is_final;
        self.updated_at = Utc::now();
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

    /// The natural balance side for this account type (Section 12 of the
    /// accounting spec): a NEGATIVE signed value on a Debit-normal account or a
    /// POSITIVE value on a Credit-normal account is a contra/abnormal balance.
    pub fn normal_balance(&self) -> NormalBalance {
        if self.is_debit_account() {
            NormalBalance::Debit
        } else {
            NormalBalance::Credit
        }
    }

    /// Signed ledger balance expressed so that a positive value sits on the
    /// account's natural (normal) side:
    ///   Debit-normal accounts:  +balance = debit,  −balance = credit
    ///   Credit-normal accounts: +balance = credit, −balance = debit
    pub fn signed_balance(&self) -> Decimal {
        match self.normal_balance() {
            NormalBalance::Debit => self.balance,
            NormalBalance::Credit => -self.balance,
        }
    }

    /// Display balance always positive; the side is reported separately (via
    /// `signed_balance` or `is_debit_account()`) so UIs never print negative
    /// totals for a normal credit balance.
    pub fn display_balance(&self) -> Decimal {
        self.balance.abs()
    }

    /// Partner-drawings accounts (contra equity) live under chart prefix `44`
    /// and are NOT operating expenses. They must never appear in the P&L.
    pub fn is_drawings_account(&self) -> bool {
        self.code.starts_with("44")
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }

    pub fn link_customer(&mut self, customer_id: CustomerId) {
        self.linked_customer_id = Some(customer_id);
        self.updated_at = Utc::now();
    }

    pub fn link_supplier(&mut self, supplier_id: SupplierId) {
        self.linked_supplier_id = Some(supplier_id);
        self.updated_at = Utc::now();
    }

    pub fn unlink_customer(&mut self) {
        self.linked_customer_id = None;
        self.updated_at = Utc::now();
    }

    pub fn unlink_supplier(&mut self) {
        self.linked_supplier_id = None;
        self.updated_at = Utc::now();
    }

    /// هل هذا الحساب مربوط بعميل؟
    pub fn is_linked_to_customer(&self) -> bool {
        self.linked_customer_id.is_some()
    }

    /// هل هذا الحساب مربوط بمورد؟
    pub fn is_linked_to_supplier(&self) -> bool {
        self.linked_supplier_id.is_some()
    }

    /// هل هذا الحساب ضمن ذمم العملاء؟ (كود يبدأ بـ 1203)
    pub fn is_receivable_account(&self) -> bool {
        self.code.starts_with("1203") && self.account_type == AccountType::Assets
    }

    /// هل هذا الحساب ضمن ذمم الموردين؟ (كود يبدأ بـ 2203)
    pub fn is_payable_account(&self) -> bool {
        self.code.starts_with("2203") && self.account_type == AccountType::Liabilities
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn create_test_account(
        code: &str,
        name_ar: &str,
        name_en: &str,
        acc_type: AccountType,
    ) -> Result<Account, DomainError> {
        let base_currency = Currency::new("USD", "US Dollar", "US Dollar", "$", 2, true);
        Account::new(
            code.to_string(),
            name_ar.to_string(),
            name_en.to_string(),
            acc_type,
            None,
            AccountCategory::Detail,
            1,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            base_currency,
            Decimal::ONE,
            None,
        )
    }

    #[test]
    fn account_creation_with_valid_data_succeeds() {
        let account = create_test_account("1001", "النقدية", "Cash", AccountType::Assets).unwrap();
        assert_eq!(account.code, "1001");
        assert_eq!(account.name_ar, "النقدية");
        assert_eq!(account.balance, Decimal::ZERO);
    }

    #[test]
    fn account_code_cannot_be_empty() {
        let result = create_test_account("", "النقدية", "Cash", AccountType::Assets);
        assert!(result.is_err());
    }

    #[test]
    fn account_name_ar_cannot_be_empty() {
        let result = create_test_account("1001", "", "Cash", AccountType::Assets);
        assert!(result.is_err());
    }

    #[test]
    fn debit_increases_balance() {
        let mut account =
            create_test_account("1001", "النقدية", "Cash", AccountType::Assets).unwrap();
        account.debit(dec!(100)).unwrap();
        assert_eq!(account.balance, dec!(100));
    }

    #[test]
    fn credit_decreases_balance() {
        let mut account =
            create_test_account("1001", "النقدية", "Cash", AccountType::Assets).unwrap();
        account.debit(dec!(100)).unwrap();
        account.credit(dec!(50)).unwrap();
        assert_eq!(account.balance, dec!(50));
    }

    #[test]
    fn negative_debit_is_rejected() {
        let mut account =
            create_test_account("1001", "النقدية", "Cash", AccountType::Assets).unwrap();
        let result = account.debit(dec!(-10));
        assert!(result.is_err());
    }

    #[test]
    fn negative_credit_is_rejected() {
        let mut account =
            create_test_account("1001", "النقدية", "Cash", AccountType::Assets).unwrap();
        let result = account.credit(dec!(-10));
        assert!(result.is_err());
    }

    #[test]
    fn assets_account_is_debit_account() {
        let account = create_test_account("1001", "النقدية", "Cash", AccountType::Assets).unwrap();
        assert!(account.is_debit_account());
    }

    #[test]
    fn expenses_account_is_debit_account() {
        let account =
            create_test_account("5001", "المصاريف", "Expenses", AccountType::Expenses).unwrap();
        assert!(account.is_debit_account());
    }

    #[test]
    fn liabilities_account_is_credit_account() {
        let account =
            create_test_account("2001", "الدائنون", "Creditors", AccountType::Liabilities).unwrap();
        assert!(account.is_credit_account());
    }

    #[test]
    fn equity_account_is_credit_account() {
        let account =
            create_test_account("3001", "رأس المال", "Capital", AccountType::Equity).unwrap();
        assert!(account.is_credit_account());
    }

    #[test]
    fn revenue_account_is_credit_account() {
        let account =
            create_test_account("4001", "المبيعات", "Sales", AccountType::Revenue).unwrap();
        assert!(account.is_credit_account());
    }

    // --- Normal balance semantics (Sec 12) ---

    fn with_balance(acc_type: AccountType, opening: Decimal) -> Account {
        create_test_account("1", "acc", "acc", acc_type)
            .map(|mut a| {
                a.opening_balance = opening;
                a.balance = opening;
                a
            })
            .unwrap()
    }

    #[test]
    fn asset_is_debit_normal() {
        let a = with_balance(AccountType::Assets, dec!(500));
        assert_eq!(a.normal_balance(), NormalBalance::Debit);
        assert_eq!(a.signed_balance(), dec!(500));
        assert_eq!(a.display_balance(), dec!(500));
    }

    #[test]
    fn expense_is_debit_normal() {
        let a = with_balance(AccountType::Expenses, dec!(300));
        assert_eq!(a.normal_balance(), NormalBalance::Debit);
        assert_eq!(a.signed_balance(), dec!(300));
    }

    #[test]
    fn asset_credit_contra_is_negative_signed() {
        let mut a = with_balance(AccountType::Assets, Decimal::ZERO);
        a.credit(dec!(40)).unwrap(); // abnormal (credit) side of an asset
        assert_eq!(a.signed_balance(), dec!(-40));
        assert_eq!(a.display_balance(), dec!(40));
    }

    #[test]
    fn expense_credit_contra_is_negative_signed() {
        let mut a = with_balance(AccountType::Expenses, Decimal::ZERO);
        a.credit(dec!(25)).unwrap();
        assert_eq!(a.signed_balance(), dec!(-25));
    }

    #[test]
    fn liability_is_credit_normal() {
        let mut a = with_balance(AccountType::Liabilities, Decimal::ZERO);
        a.credit(dec!(1000)).unwrap();
        assert_eq!(a.normal_balance(), NormalBalance::Credit);
        assert_eq!(a.signed_balance(), dec!(1000)); // positive = credit
    }

    #[test]
    fn equity_is_credit_normal() {
        let mut a = with_balance(AccountType::Equity, Decimal::ZERO);
        a.credit(dec!(4000)).unwrap();
        assert_eq!(a.normal_balance(), NormalBalance::Credit);
        assert_eq!(a.signed_balance(), dec!(4000));
    }

    #[test]
    fn equity_debit_contra_is_negative_signed() {
        let mut a = with_balance(AccountType::Equity, Decimal::ZERO);
        a.credit(dec!(100)).unwrap();  // natural credit 100
        a.debit(dec!(130)).unwrap();   // drawings push it to a net debit of 30
        assert_eq!(a.signed_balance(), dec!(-30));
        assert_eq!(a.display_balance(), dec!(30));
    }

    #[test]
    fn revenue_is_credit_normal() {
        let mut a = with_balance(AccountType::Revenue, Decimal::ZERO);
        a.credit(dec!(800)).unwrap();
        assert_eq!(a.normal_balance(), NormalBalance::Credit);
        assert_eq!(a.signed_balance(), dec!(800));
    }

    #[test]
    fn revenue_debit_contra_is_negative_signed() {
        let mut a = with_balance(AccountType::Revenue, Decimal::ZERO);
        a.credit(dec!(100)).unwrap();
        a.debit(dec!(110)).unwrap(); // net debit 10 → contra
        assert_eq!(a.signed_balance(), dec!(-10));
    }

    #[test]
    fn drawings_accounts_are_detected_by_prefix_44() {
        let drawings = create_test_account("4401", "مسحوبات", "Drawings", AccountType::Expenses).unwrap();
        assert!(drawings.is_drawings_account());
        let capital = create_test_account("5101", "رأس المال", "Capital", AccountType::Equity).unwrap();
        assert!(!capital.is_drawings_account());
    }
}

