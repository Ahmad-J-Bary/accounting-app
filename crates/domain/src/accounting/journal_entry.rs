#![allow(clippy::invisible_characters)]
use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, JournalEntryId};
use crate::shared::monetary_amount::MonetaryAmount;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use rust_decimal::Decimal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLine {
    pub account_id: AccountId,
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
            debit,
            credit,
            description,
        }
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
            return Err(DomainError::Invalid(
                "Ø±Ù‚Ù… Ø§Ù„Ù‚ÙŠØ¯ Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø£Ù† ÙŠÙƒÙˆÙ† ÙØ§Ø±ØºÙ‹Ø§".into(),
            ));
        }

        if lines.is_empty() {
            return Err(DomainError::Invalid(
                "Ø§Ù„Ù‚ÙŠØ¯ ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø³Ø·Ø± ÙˆØ§Ø­Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„".into(),
            ));
        }

        if description.trim().is_empty() {
            return Err(DomainError::Invalid(
                "ÙˆØµÙ Ø§Ù„Ù‚ÙŠØ¯ Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø£Ù† ÙŠÙƒÙˆÙ† ÙØ§Ø±ØºÙ‹Ø§".into(),
            ));
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
            return Err(DomainError::Invalid(
                "ÙŠÙ…ÙƒÙ† ØªØ±Ø­ÙŠÙ„ Ø§Ù„Ù‚ÙŠÙˆØ¯ Ø§Ù„Ù…Ø³ÙˆØ¯Ø© ÙÙ‚Ø·".into(),
            ));
        }

        if !self.is_balanced() {
            return Err(DomainError::Invalid(format!(
                "Ø§Ù„Ù‚ÙŠØ¯ ØºÙŠØ± Ù…ØªÙˆØ§Ø²Ù† Ø¨Ø§Ù„Ù„ÙŠØ±Ø© Ø§Ù„Ø³ÙˆØ±ÙŠØ©. Ù…Ø¯ÙŠÙ†: {} ØŒ Ø¯Ø§Ø¦Ù†: {}",
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
            return Err(DomainError::Forbidden(
                "ÙŠÙ…ÙƒÙ† Ø¹ÙƒØ³ Ø§Ù„Ù‚ÙŠÙˆØ¯ Ø§Ù„Ù…Ø±Ø­Ù„Ø© ÙÙ‚Ø·".into(),
            ));
        }

        self.status = JournalEntryStatus::Reversed;
        self.reversed_at = Some(Utc::now());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::currency::Currency;
    use crate::shared::money::Money;
    use rust_decimal_macros::dec;

    #[test]
    fn journal_entry_creation_with_valid_data_succeeds() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::syp(dec!(100)), Decimal::ONE),
                MonetaryAmount::zero(Currency::syp()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(Currency::syp()),
                MonetaryAmount::new(Money::syp(dec!(100)), Decimal::ONE),
                "دائن".to_string(),
            ),
        ];

        let result = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "Ù‚ÙŠØ¯ ØªØ¬Ø±ÙŠØ¨ÙŠ".to_string(),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn multi_currency_balanced_entry_can_be_posted() {
        let fx_rate = dec!(15000); // 1 USD = 15000 SYP
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::usd(dec!(10)), fx_rate),
                MonetaryAmount::zero(Currency::usd()),
                "مدين بالدولار".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(Currency::syp()),
                MonetaryAmount::new(Money::syp(dec!(150000)), dec!(1)),
                "دائن بالليرة".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "Ù‚ÙŠØ¯ Ø¹Ù…Ù„Ø§Øª Ù…Ø®ØªÙ„Ø·Ø©".to_string(),
        )
        .unwrap();

        assert!(entry.post().is_ok());
    }

    #[test]
    fn unbalanced_multi_currency_is_rejected() {
        let fx_rate = dec!(15000);
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::usd(dec!(10)), fx_rate),
                MonetaryAmount::zero(Currency::usd()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(Currency::syp()),
                MonetaryAmount::new(Money::syp(dec!(140000)), dec!(1)),
                "دائن".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "Ù‚ÙŠØ¯ ØºÙŠØ± Ù…ØªÙˆØ§Ø²Ù†".to_string(),
        )
        .unwrap();

        assert!(entry.post().is_err());
    }

    #[test]
    fn posting_twice_is_rejected() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::syp(dec!(100)), dec!(1)),
                MonetaryAmount::zero(Currency::syp()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(Currency::syp()),
                MonetaryAmount::new(Money::syp(dec!(100)), dec!(1)),
                "دائن".to_string(),
            ),
        ];

        let mut entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "Ù‚ÙŠØ¯ ØªØ¬Ø±ÙŠØ¨ÙŠ".to_string(),
        )
        .unwrap();

        entry.post().unwrap();
        assert!(entry.post().is_err());
    }

    #[test]
    fn total_base_debit_calculates_correctly() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::syp(dec!(100)), dec!(1)),
                MonetaryAmount::zero(Currency::syp()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::new(Money::usd(dec!(10)), dec!(15000)),
                MonetaryAmount::zero(Currency::usd()),
                "مدين دولار".to_string(),
            ),
        ];

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "Ù‚ÙŠØ¯ ØªØ¬Ø±ÙŠØ¨ÙŠ".to_string(),
        )
        .unwrap();

        assert_eq!(entry.total_base_debit(), dec!(150100));
    }

    #[test]
    fn total_base_credit_calculates_correctly() {
        let lines = vec![
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(Currency::syp()),
                MonetaryAmount::new(Money::syp(dec!(100)), dec!(1)),
                "دائن".to_string(),
            ),
            JournalLine::new(
                AccountId(Uuid::new_v4()),
                MonetaryAmount::zero(Currency::usd()),
                MonetaryAmount::new(Money::usd(dec!(10)), dec!(15000)),
                "دائن دولار".to_string(),
            ),
        ];

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            lines,
            Utc::now(),
            "Ù‚ÙŠØ¯ ØªØ¬Ø±ÙŠØ¨ÙŠ".to_string(),
        )
        .unwrap();

        assert_eq!(entry.total_base_credit(), dec!(150100));
    }
}
