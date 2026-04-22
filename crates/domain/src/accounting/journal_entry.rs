use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, JournalEntryId};
use crate::shared::money::Money;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::shared::currency::Currency;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLine {
    pub account_id: AccountId,
    pub currency: Currency,
    pub fx_rate: Decimal, // سعر الصرف مقابل الليرة السورية
    pub debit: Money,
    pub credit: Money,
    pub description: String,
}

impl JournalLine {
    pub fn new(
        account_id: AccountId,
        currency: Currency,
        fx_rate: Decimal,
        debit: Money,
        credit: Money,
        description: String,
    ) -> Self {
        Self {
            account_id,
            currency,
            fx_rate,
            debit,
            credit,
            description,
        }
    }

    pub fn base_debit(&self) -> Decimal {
        self.debit.to_base(self.fx_rate)
    }

    pub fn base_credit(&self) -> Decimal {
        self.credit.to_base(self.fx_rate)
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
    pub lines: Vec<JournalLine>,
    pub entry_date: DateTime<Utc>,
    pub description: String,
    pub status: JournalEntryStatus,
    pub created_at: DateTime<Utc>,
    pub posted_at: Option<DateTime<Utc>>,
    pub reversed_at: Option<DateTime<Utc>>,
}

impl JournalEntry {
    pub fn new(
        entry_number: String,
        lines: Vec<JournalLine>,
        entry_date: DateTime<Utc>,
        description: String,
    ) -> Result<Self, DomainError> {
        if entry_number.trim().is_empty() {
            return Err(DomainError::Invalid("رقم القيد لا يمكن أن يكون فارغًا".into()));
        }

        if lines.is_empty() {
            return Err(DomainError::Invalid("القيد يجب أن يحتوي على سطر واحد على الأقل".into()));
        }

        if description.trim().is_empty() {
            return Err(DomainError::Invalid("وصف القيد لا يمكن أن يكون فارغًا".into()));
        }

        let now = Utc::now();

        Ok(Self {
            id: JournalEntryId(Uuid::new_v4()),
            entry_number,
            lines,
            entry_date,
            description,
            status: JournalEntryStatus::Draft,
            created_at: now,
            posted_at: None,
            reversed_at: None,
        })
    }

    pub fn total_base_debit(&self) -> Decimal {
        self.lines.iter().map(|l| l.base_debit()).sum()
    }

    pub fn total_base_credit(&self) -> Decimal {
        self.lines.iter().map(|l| l.base_credit()).sum()
    }

    pub fn is_balanced(&self) -> bool {
        self.total_base_debit() == self.total_base_credit()
    }

    pub fn post(&mut self) -> Result<(), DomainError> {
        if self.status != JournalEntryStatus::Draft {
            return Err(DomainError::Invalid("يمكن ترحيل القيود المسودة فقط".into()));
        }

        if !self.is_balanced() {
            return Err(DomainError::Invalid(format!(
                "القيد غير متوازن بالليرة السورية. مدين: {} ، دائن: {}",
                self.total_base_debit(),
                self.total_base_credit()
            )));
        }

        self.status = JournalEntryStatus::Posted;
        self.posted_at = Some(Utc::now());
        Ok(())
    }

    pub fn reverse(&mut self) -> Result<(), DomainError> {
        if self.status != JournalEntryStatus::Posted {
            return Err(DomainError::Forbidden("يمكن عكس القيود المرحلة فقط".into()));
        }

        self.status = JournalEntryStatus::Reversed;
        self.reversed_at = Some(Utc::now());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn journal_entry_creation_with_valid_data_succeeds() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                Decimal::ONE,
                Money::syp(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                Decimal::ONE,
                Money::zero(),
                Money::syp(dec!(100)),
                "دائن".to_string(),
            ),
        ];

        let result = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn multi_currency_balanced_entry_can_be_posted() {
        let fx_rate = dec!(15000); // 1 USD = 15000 SYP
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::USD,
                fx_rate,
                Money::usd(dec!(10)), // 150,000 SYP
                Money::zero(),
                "مدين بالدولار".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                dec!(1),
                Money::zero(),
                Money::syp(dec!(150000)), // 150,000 SYP
                "دائن بالليرة".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد عملات مختلطة".to_string(),
        ).unwrap();

        assert!(entry.post().is_ok());
    }

    #[test]
    fn unbalanced_multi_currency_is_rejected() {
        let fx_rate = dec!(15000);
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::USD,
                fx_rate,
                Money::usd(dec!(10)), // 150,000 SYP
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                dec!(1),
                Money::zero(),
                Money::syp(dec!(140000)), // 140,000 SYP -> Unbalanced
                "دائن".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد غير متوازن".to_string(),
        ).unwrap();

        assert!(entry.post().is_err());
    }

    #[test]
    fn posting_twice_is_rejected() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                dec!(1),
                Money::syp(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                dec!(1),
                Money::zero(),
                Money::syp(dec!(100)),
                "دائن".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        ).unwrap();

        entry.post().unwrap();
        assert!(entry.post().is_err());
    }

    #[test]
    fn total_base_debit_calculates_correctly() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                dec!(1),
                Money::syp(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::USD,
                dec!(15000),
                Money::usd(dec!(10)), // 150,000 SYP
                Money::zero(),
                "مدين دولار".to_string(),
            ),
        ];

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        ).unwrap();

        assert_eq!(entry.total_base_debit(), dec!(150100));
    }

    #[test]
    fn total_base_credit_calculates_correctly() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::SYP,
                dec!(1),
                Money::zero(),
                Money::syp(dec!(100)),
                "دائن".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Currency::USD,
                dec!(15000),
                Money::zero(),
                Money::usd(dec!(10)), // 150,000 SYP
                "دائن دولار".to_string(),
            ),
        ];

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        ).unwrap();

        assert_eq!(entry.total_base_credit(), dec!(150100));
    }
}
