use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, JournalEntryId};
use crate::shared::money::Money;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLine {
    pub account_id: AccountId,
    pub debit: Money,
    pub credit: Money,
    pub description: String,
}

impl JournalLine {
    pub fn new(account_id: AccountId, debit: Money, credit: Money, description: String) -> Self {
        Self {
            account_id,
            debit,
            credit,
            description,
        }
    }

    pub fn is_balanced(&self) -> bool {
        self.debit.amount() == self.credit.amount()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JournalEntryStatus {
    Draft,
    Posted,
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
        })
    }

    pub fn total_debit(&self) -> Money {
        self.lines.iter().fold(Money::zero(), |acc, line| {
            acc + line.debit.clone()
        })
    }

    pub fn total_credit(&self) -> Money {
        self.lines.iter().fold(Money::zero(), |acc, line| {
            acc + line.credit.clone()
        })
    }

    pub fn is_balanced(&self) -> bool {
        self.total_debit().amount() == self.total_credit().amount()
    }

    pub fn post(&mut self) -> Result<(), DomainError> {
        if self.status == JournalEntryStatus::Posted {
            return Err(DomainError::Invalid("القيد مُرحّل مسبقًا".into()));
        }

        if self.status == JournalEntryStatus::Cancelled {
            return Err(DomainError::Invalid("القيد ملغي".into()));
        }

        if !self.is_balanced() {
            return Err(DomainError::Invalid("القيد غير متوازن".into()));
        }

        if self.lines.is_empty() {
            return Err(DomainError::Invalid("لا يمكن ترحيل قيد فارغ".into()));
        }

        self.status = JournalEntryStatus::Posted;
        self.posted_at = Some(Utc::now());
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<(), DomainError> {
        if self.status == JournalEntryStatus::Posted {
            return Err(DomainError::Forbidden("لا يمكن إلغاء قيد مُرحّل".into()));
        }

        if self.status == JournalEntryStatus::Cancelled {
            return Err(DomainError::Invalid("القيد ملغي مسبقًا".into()));
        }

        self.status = JournalEntryStatus::Cancelled;
        Ok(())
    }

    pub fn add_line(&mut self, line: JournalLine) -> Result<(), DomainError> {
        if self.status == JournalEntryStatus::Posted {
            return Err(DomainError::Forbidden("لا يمكن إضافة سطر لقيد مُرحّل".into()));
        }

        self.lines.push(line);
        Ok(())
    }

    pub fn remove_line(&mut self, index: usize) -> Result<(), DomainError> {
        if self.status == JournalEntryStatus::Posted {
            return Err(DomainError::Forbidden("لا يمكن حذف سطر من قيد مُرحّل".into()));
        }

        if index >= self.lines.len() {
            return Err(DomainError::Invalid("مؤشر السطر غير صالح".into()));
        }

        self.lines.remove(index);
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
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(100)),
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
    fn journal_entry_number_cannot_be_empty() {
        let result = JournalEntry::new(
            "".to_string(),
            vec![],
            Utc::now(),
            "قيد تجريبي".to_string(),
        );

        assert!(result.is_err());
    }

    #[test]
    fn journal_entry_lines_cannot_be_empty() {
        let result = JournalEntry::new(
            "JE-001".to_string(),
            vec![],
            Utc::now(),
            "قيد تجريبي".to_string(),
        );

        assert!(result.is_err());
    }

    #[test]
    fn journal_entry_description_cannot_be_empty() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
        ];

        let result = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "".to_string(),
        );

        assert!(result.is_err());
    }

    #[test]
    fn balanced_journal_entry_can_be_posted() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(100)),
                "دائن".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        ).unwrap();

        assert!(entry.post().is_ok());
        assert!(matches!(entry.status, JournalEntryStatus::Posted));
    }

    #[test]
    fn unbalanced_journal_entry_cannot_be_posted() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(50)),
                "دائن".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        ).unwrap();

        assert!(entry.post().is_err());
    }

    #[test]
    fn posting_twice_is_rejected() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(100)),
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
    fn cannot_add_line_to_posted_entry() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(100)),
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

        let new_line = JournalLine::new(
            AccountId(Uuid::new_v4()),
            Money::from(dec!(50)),
            Money::zero(),
            "مدين".to_string(),
        );

        assert!(entry.add_line(new_line).is_err());
    }

    #[test]
    fn cannot_remove_line_from_posted_entry() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(100)),
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

        assert!(entry.remove_line(0).is_err());
    }

    #[test]
    fn total_debit_calculates_correctly() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(100)),
                Money::zero(),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::from(dec!(50)),
                Money::zero(),
                "مدين".to_string(),
            ),
        ];

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        ).unwrap();

        assert_eq!(entry.total_debit().amount(), dec!(150));
    }

    #[test]
    fn total_credit_calculates_correctly() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(100)),
                "دائن".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                Money::zero(),
                Money::from(dec!(50)),
                "دائن".to_string(),
            ),
        ];

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "قيد تجريبي".to_string(),
        ).unwrap();

        assert_eq!(entry.total_credit().amount(), dec!(150));
    }
}
