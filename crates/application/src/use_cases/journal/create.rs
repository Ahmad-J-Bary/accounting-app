use std::sync::Arc;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::{AccountId, Money, MonetaryAmount};
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
                let currency = domain::shared::currency::Currency::new(&dto.currency, &dto.currency, &dto.currency, "", 2, false);
                let fx_rate = rust_decimal::Decimal::from_str(&dto.fx_rate)
                    .unwrap_or(rust_decimal::Decimal::ONE);

                let debit = Money::new(
                    rust_decimal::Decimal::from_str(&dto.debit)
                        .map_err(|e| AppError::Invalid(format!("Invalid debit amount: {}", e)))?,
                    currency.clone()
                );
                let credit = Money::new(
                    rust_decimal::Decimal::from_str(&dto.credit)
                        .map_err(|e| AppError::Invalid(format!("Invalid credit amount: {}", e)))?,
                    currency.clone()
                );
                let mut line = JournalLine::new(
                    account_id,
                    MonetaryAmount::new(debit, fx_rate),
                    MonetaryAmount::new(credit, fx_rate),
                    dto.description
                );
                if let Some(pid_str) = dto.partner_id {
                    if let Ok(pid) = Uuid::parse_str(&pid_str) {
                        line.partner_id = Some(pid);
                    }
                }
                Ok(line)
            })
            .collect();

        let lines = lines?;

        let entry_date = DateTime::parse_from_rfc3339(&request.entry_date)
            .map_err(|e| AppError::Invalid(format!("Invalid entry date: {}", e)))?
            .with_timezone(&Utc);

        let entry = JournalEntry::new(
            self.repo.get_next_entry_number().await?,
            request.journal_type,
            lines,
            entry_date,
            request.description,
            request.source_id,
        ).map_err(AppError::from)?;

        self.repo.save(&entry).await?;

        Ok(JournalEntryDto::from(entry))
    }
}
