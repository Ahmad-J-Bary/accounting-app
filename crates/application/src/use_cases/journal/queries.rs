use std::sync::Arc;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::journal_entry_dto::{JournalEntryDto};
use crate::errors::AppError;
use domain::accounting::{JournalType, JournalEntryStatus};
use domain::shared::ids::AccountId;
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct ListJournalEntriesUseCase {
    repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl ListJournalEntriesUseCase {
    pub fn new(
        repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, account_repo }
    }

    pub async fn execute(
        &self,
        from_date: Option<String>,
        to_date: Option<String>,
        journal_type: Option<JournalType>,
        account_id: Option<String>,
        partner_id: Option<String>,
        status: Option<String>,
    ) -> Result<Vec<JournalEntryDto>, AppError> {
        let from = from_date.and_then(|d| DateTime::parse_from_rfc3339(&d).ok().map(|dt| dt.with_timezone(&Utc)));
        let to = to_date.and_then(|d| DateTime::parse_from_rfc3339(&d).ok().map(|dt| dt.with_timezone(&Utc)));
        let acc_id = account_id.and_then(|id| id.parse::<AccountId>().ok());
        let part_id = partner_id.and_then(|id| Uuid::parse_str(&id).ok());
        let status_enum = status.and_then(|s| match s.as_str() {
            "Draft" => Some(JournalEntryStatus::Draft),
            "Posted" => Some(JournalEntryStatus::Posted),
            "Reversed" => Some(JournalEntryStatus::Reversed),
            "Cancelled" => Some(JournalEntryStatus::Cancelled),
            _ => None,
        });

        let entries = self.repo.list_with_filters(from, to, journal_type, acc_id, part_id, status_enum).await?;
        
        let mut dtos = Vec::new();
        for entry in entries {
            dtos.push(self.map_to_dto(entry).await?);
        }
        
        Ok(dtos)
    }

    pub async fn get_details(&self, id: String) -> Result<JournalEntryDto, AppError> {
        let entry_id = id.parse().map_err(|_| AppError::Invalid("معرف قيد غير صالح".into()))?;
        let entry = self.repo.find_by_id(&entry_id).await?
            .ok_or_else(|| AppError::NotFound("القيد غير موجود".into()))?;
            
        self.map_to_dto(entry).await
    }

    async fn map_to_dto(&self, entry: domain::accounting::JournalEntry) -> Result<JournalEntryDto, AppError> {
        let mut dto = JournalEntryDto::from(entry);
        
        // Enrich lines with account names
        for line in &mut dto.lines {
            if let Ok(acc_id) = line.account_id.parse::<AccountId>() {
                line.account_name = self.account_repo.find_by_id(&acc_id).await?.map(|a| a.name_ar);
            }
        }

        Ok(dto)
    }
}
