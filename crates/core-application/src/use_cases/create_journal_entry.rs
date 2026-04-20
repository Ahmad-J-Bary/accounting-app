use std::sync::Arc;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use core_domain::accounting::journal_entry::{JournalEntry, JournalLine};
use core_domain::shared::{AccountId, Money};
use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::journal_entry_dto::{CreateJournalEntryRequest, JournalEntryDto};

pub struct CreateJournalEntryUseCase {
    repo: Arc<dyn JournalEntryRepository>,
}

impl CreateJournalEntryUseCase {
    pub fn new(repo: Arc<dyn JournalEntryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, request: CreateJournalEntryRequest) -> Result<JournalEntryDto, AppError> {
        let lines: Result<Vec<JournalLine>, AppError> = request.lines
            .into_iter()
            .map(|dto| {
                let account_id = AccountId(
                    Uuid::parse_str(&dto.account_id)
                        .map_err(|e| AppError::Invalid(format!("Invalid account ID: {}", e)))?
                );
                let debit = Money::new(
                    rust_decimal::Decimal::from_str(&dto.debit)
                        .map_err(|e| AppError::Invalid(format!("Invalid debit amount: {}", e)))?
                );
                let credit = Money::new(
                    rust_decimal::Decimal::from_str(&dto.credit)
                        .map_err(|e| AppError::Invalid(format!("Invalid credit amount: {}", e)))?
                );
                Ok(JournalLine::new(account_id, debit, credit, dto.description))
            })
            .collect();

        let lines = lines?;

        let entry_date = DateTime::parse_from_rfc3339(&request.entry_date)
            .map_err(|e| AppError::Invalid(format!("Invalid entry date: {}", e)))?
            .with_timezone(&Utc);

        let entry = JournalEntry::new(
            request.entry_number,
            lines,
            entry_date,
            request.description,
        ).map_err(AppError::from)?;

        self.repo.save(&entry).await?;

        Ok(JournalEntryDto::from(entry))
    }
}
