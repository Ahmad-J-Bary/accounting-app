#![allow(clippy::invisible_characters)]
use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, JournalEntryId};
use crate::shared::monetary_amount::MonetaryAmount;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use rust_decimal::Decimal;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum JournalType {
    CashReceipt,          // سند قبض
    CashPayment,          // سند دفع
    SupplierReceiptJournal,// سند قبض من مورد
    CustomerPaymentJournal,// سند دفع لعميل
    ExpenseVoucher,       // سند مصاريف
    DrawingsVoucher,      // سند مسحوبات
    CashOpeningBalance,   // رصيد افتتاحي للخزينة
    AccountOpeningBalance,// رصيد افتتاحي لحساب
    CashJournal,          // يومية الصندوق
    CashSalesJournal,     // يومية المبيعات النقدية
    CreditSalesJournal,   // يومية المبيعات الآجلة
    PurchaseJournal,      // يومية المشتريات
    PurchaseCostsJournal, // يومية التكاليف الإضافية للمشتريات
    MaterialOpeningBalance,// رصيد افتتاحي للمواد
    GeneralJournal,       // اليومية العامة
    SalesReturnJournal,   // مرتجع مبيعات
    PurchaseReturnJournal,// مرتجع مشتريات
    DamagedJournal,       // خسائر المواد التالفة
    AdjustmentJournal,    // تسوية جرد (فائض/عجز)
    DiscountEarnedJournal,// حسم مكتسب
    DiscountGrantedJournal,// حسم ممنوح
    CapitalContribution,// مساهمة رأس مال
    ProfitDistribution,// توزيع أرباح على الشركاء
    OpeningBalanceReversal,// عكس ترحيل رصيد الافتتاح
}

impl std::fmt::Display for JournalType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::CashReceipt => "سند قبض",
            Self::CashPayment => "سند دفع",
            Self::SupplierReceiptJournal => "سند قبض من مورد",
            Self::CustomerPaymentJournal => "سند دفع لعميل",
            Self::ExpenseVoucher => "سند مصاريف",
            Self::DrawingsVoucher => "سند مسحوبات",
            Self::CashOpeningBalance => "رصيد افتتاحي",
            Self::AccountOpeningBalance => "رصيد افتتاحي",
            Self::MaterialOpeningBalance => "رصيد افتتاحي للمواد / أول المدة",
            Self::CashJournal => "يومية الصندوق",
            Self::CashSalesJournal => "يومية المبيعات النقدية",
            Self::CreditSalesJournal => "يومية المبيعات الآجلة",
            Self::PurchaseJournal => "مشتريات",
            Self::PurchaseCostsJournal => "تكاليف إضافية للمشتريات",
            Self::GeneralJournal => "اليومية العامة",
            Self::SalesReturnJournal => "مرتجع مبيعات",
            Self::PurchaseReturnJournal => "مرتجع مشتريات",
            Self::DamagedJournal => "خسائر المواد التالفة",
            Self::AdjustmentJournal => "تسوية جرد",
            Self::DiscountEarnedJournal => "حسم مكتسب",
            Self::DiscountGrantedJournal => "حسم ممنوح",
            Self::CapitalContribution => "مساهمة رأس مال",
            Self::ProfitDistribution => "توزيع أرباح",
            Self::OpeningBalanceReversal => "عكس ترحيل رصيد الافتتاح",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLine {
    pub account_id: AccountId,
    pub partner_id: Option<Uuid>, // For tracking customers/suppliers/partners
    pub debit: MonetaryAmount,
    pub credit: MonetaryAmount,
    pub description: String,
}

impl JournalLine {
    pub fn new(
        account_id: AccountId,
        debit: MonetaryAmount,
        credit: MonetaryAmount,
        description: String,
    ) -> Self {
        Self {
            account_id,
            partner_id: None,
            debit,
            credit,
            description,
        }
    }

    pub fn with_partner(mut self, partner_id: Uuid) -> Self {
        self.partner_id = Some(partner_id);
        self
    }

    pub fn base_debit(&self) -> Decimal {
        self.debit.base_amount
    }

    pub fn base_credit(&self) -> Decimal {
        self.credit.base_amount
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JournalEntryStatus {
    Draft,
    Posted,
    Reversed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub id: JournalEntryId,
    pub entry_number: String,
    pub journal_type: JournalType,
    pub source_id: Option<String>, // ID of the source document (Invoice, Receipt, etc.)
    pub source_type: Option<String>, // Originating business domain
    pub lines: Vec<JournalLine>,
    pub entry_date: DateTime<Utc>,
    pub description: String,
    pub status: JournalEntryStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub posted_at: Option<DateTime<Utc>>,
    pub reversed_at: Option<DateTime<Utc>>,
}

impl JournalEntry {
    pub fn new(
        entry_number: String,
        journal_type: JournalType,
        lines: Vec<JournalLine>,
        entry_date: DateTime<Utc>,
        description: String,
        source_id: Option<String>,
    ) -> Result<Self, DomainError> {
        if entry_number.trim().is_empty() {
            return Err(DomainError::Invalid(
                "رقم القيد لا يمكن أن يكون فارغاً".into(),
            ));
        }

        if lines.is_empty() {
            return Err(DomainError::Invalid(
                "القيد يجب أن يحتوي على سطر واحد على الأقل".into(),
            ));
        }

        for line in &lines {
            let has_debit = line.base_debit() > Decimal::ZERO;
            let has_credit = line.base_credit() > Decimal::ZERO;
            
            if has_debit && has_credit {
                return Err(DomainError::Invalid("لا يمكن أن يكون السطر مديناً ودائناً في نفس الوقت. يجب تفصيل القيد المركب إلى سطور مستقلة.".into()));
            }
        }

        if description.trim().is_empty() {
            return Err(DomainError::Invalid(
                "وصف القيد لا يمكن أن يكون فارغاً".into(),
            ));
        }

        let now = Utc::now();

        Ok(Self {
            id: JournalEntryId(Uuid::new_v4()),
            entry_number,
            journal_type,
            source_id,
            source_type: None,
            lines,
            entry_date,
            description,
            status: JournalEntryStatus::Draft,
            created_at: now,
            updated_at: now,
            posted_at: None,
            reversed_at: None,
        })
    }

    pub fn with_source(mut self, source_id: String) -> Self {
        self.source_id = Some(source_id);
        self
    }

    pub fn total_base_debit(&self) -> Decimal {
        self.lines.iter().map(|l| l.base_debit()).sum()
    }

    pub fn total_base_credit(&self) -> Decimal {
        self.lines.iter().map(|l| l.base_credit()).sum()
    }

    pub fn is_balanced(&self) -> bool {
        self.total_base_debit().normalize() == self.total_base_credit().normalize()
    }

    pub fn post(&mut self) -> Result<(), DomainError> {
        if self.status != JournalEntryStatus::Draft {
            return Err(DomainError::Invalid(
                "يمكن ترحيل القيود المسودة فقط".into(),
            ));
        }

        if !self.is_balanced() {
            return Err(DomainError::Invalid(format!(
                "القيد غير متوازن. مدين: {} ، دائن: {}",
                self.total_base_debit(),
                self.total_base_credit()
            )));
        }

        self.status = JournalEntryStatus::Posted;
        self.posted_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn reverse(&mut self) -> Result<(), DomainError> {
        if self.status != JournalEntryStatus::Posted {
            return Err(DomainError::Forbidden(
                "يمكن عكس القيود المرحلة فقط".into(),
            ));
        }

        self.status = JournalEntryStatus::Reversed;
        self.reversed_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Helper for creating purchase journal entries
    #[allow(clippy::too_many_arguments)]
    pub fn create_purchase_entry(
        entry_number: String,
        description: String,
        entry_date: DateTime<Utc>,
        purchase_account_id: AccountId,
        supplier_account_id: AccountId,
        supplier_id: Uuid,
        amount: MonetaryAmount,
        source_id: String,
    ) -> Result<Self, DomainError> {
        let lines = vec![
            JournalLine::new(
                purchase_account_id,
                amount.clone(),
                MonetaryAmount::zero(amount.currency().clone()),
                description.clone(),
            ),
            JournalLine::new(
                supplier_account_id,
                MonetaryAmount::zero(amount.currency().clone()),
                amount,
                description.clone(),
            ).with_partner(supplier_id),
        ];

        Self::new(
            entry_number,
            JournalType::PurchaseJournal,
            lines,
            entry_date,
            description,
            Some(source_id),
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_purchase_costs_entry(
        entry_number: String,
        description: String,
        entry_date: DateTime<Utc>,
        debit_account_id: AccountId,
        credit_account_id: AccountId,
        partner_id: Option<Uuid>,
        amount: MonetaryAmount,
        source_id: String,
    ) -> Result<Self, DomainError> {
        let mut line1 = JournalLine::new(
            debit_account_id,
            amount.clone(),
            MonetaryAmount::zero(amount.currency().clone()),
            description.clone(),
        );
        if let Some(pid) = partner_id { line1 = line1.with_partner(pid); }

        let mut line2 = JournalLine::new(
            credit_account_id,
            MonetaryAmount::zero(amount.currency().clone()),
            amount,
            description.clone(),
        );
        if let Some(pid) = partner_id { line2 = line2.with_partner(pid); }

        let lines = vec![line1, line2];

        Self::new(
            entry_number,
            JournalType::PurchaseCostsJournal,
            lines,
            entry_date,
            description,
            Some(source_id),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::currency::Currency;
    use crate::shared::money::Money;
    use rust_decimal_macros::dec;

    fn test_base_currency() -> Currency {
        Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
    }

    fn test_secondary_currency() -> Currency {
        Currency::new("ALT", "عملة ثانوية", "Secondary Currency", "A", 2, false)
    }

    #[test]
    fn journal_entry_creation_with_valid_data_succeeds() {
        let base_currency = test_base_currency();
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::new(dec!(100), base_currency.clone()), Decimal::ONE),
                MonetaryAmount::zero(base_currency.clone()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(base_currency.clone()),
                MonetaryAmount::new(Money::new(dec!(100), base_currency.clone()), Decimal::ONE),
                "دائن".to_string(),
            ),
        ];

        let result = JournalEntry::new(
            "JE-001".to_string(),
            JournalType::GeneralJournal,
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
            None,
        );

        assert!(result.is_ok());
    }

    #[test]
    fn multi_currency_balanced_entry_can_be_posted() {
        let (base_currency, secondary_currency) = (test_base_currency(), test_secondary_currency());
        let fx_rate = dec!(15000);
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::new(dec!(150000), secondary_currency.clone()), fx_rate),
                MonetaryAmount::zero(secondary_currency.clone()),
                "مدين بعملة ثانوية".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(base_currency.clone()),
                MonetaryAmount::new(Money::new(dec!(10), base_currency.clone()), dec!(1)),
                "دائن بعملة أساسية".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            JournalType::GeneralJournal,
            lines,
            Utc::now(),
            "قيد عملات مختلطة".to_string(),
            None,
        )
        .unwrap();

        assert!(entry.post().is_ok());
    }

    #[test]
    fn unbalanced_multi_currency_is_rejected() {
        let (base_currency, secondary_currency) = (test_base_currency(), test_secondary_currency());
        let fx_rate = dec!(15000);
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::new(dec!(150000), secondary_currency.clone()), fx_rate),
                MonetaryAmount::zero(secondary_currency.clone()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(base_currency.clone()),
                MonetaryAmount::new(Money::new(dec!(9), base_currency.clone()), dec!(1)),
                "دائن".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            JournalType::GeneralJournal,
            lines,
            Utc::now(),
            "قيد غير متوازن".to_string(),
            None,
        )
        .unwrap();

        assert!(entry.post().is_err());
    }

    #[test]
    fn total_base_debit_calculates_correctly() {
        let (base_currency, secondary_currency) = (test_base_currency(), test_secondary_currency());
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::new(dec!(100), base_currency.clone()), dec!(1)),
                MonetaryAmount::zero(base_currency.clone()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::new(dec!(150000), secondary_currency.clone()), dec!(15000)),
                MonetaryAmount::zero(secondary_currency.clone()),
                "مدين بعملة ثانوية".to_string(),
            ),
        ];

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            JournalType::GeneralJournal,
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
            None,
        )
        .unwrap();

        assert_eq!(entry.total_base_debit().normalize(), dec!(110).normalize());
    }
}
