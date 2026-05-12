use crate::dto::journal_entry_dto::JournalEntryDto;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use chrono::{DateTime, Utc};
use domain::accounting::{JournalEntryStatus, JournalType};
use domain::shared::ids::AccountId;
use std::sync::Arc;
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
        Self {
            repo,
            account_repo,
        }
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
        let from = from_date.and_then(|d| {
            DateTime::parse_from_rfc3339(&d)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });
        let to = to_date.and_then(|d| {
            DateTime::parse_from_rfc3339(&d)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });
        let acc_id = account_id.and_then(|id| id.parse::<AccountId>().ok());
        let part_id = partner_id.and_then(|id| Uuid::parse_str(&id).ok());
        let status_enum = status.and_then(|s| match s.as_str() {
            "Draft" => Some(JournalEntryStatus::Draft),
            "Posted" => Some(JournalEntryStatus::Posted),
            "Reversed" => Some(JournalEntryStatus::Reversed),
            "Cancelled" => Some(JournalEntryStatus::Cancelled),
            _ => None,
        });

        let repo_journal_type = if matches!(
            journal_type,
            Some(JournalType::CashJournal)
                | Some(JournalType::CashSalesJournal)
                | Some(JournalType::CreditSalesJournal)
                | Some(JournalType::PurchaseJournal)
                | Some(JournalType::PurchaseCostsJournal)
        ) {
            None
        } else {
            journal_type
        };

        let entries = self
            .repo
            .list_with_filters(from, to, repo_journal_type, acc_id, part_id, status_enum)
            .await?;

        let mut dtos = Vec::new();
        for entry in entries {
            let include = match journal_type {
                Some(JournalType::CashJournal) => {
                    self.entry_contains_account_prefix(&entry, "122").await?
                }
                Some(JournalType::CashSalesJournal) => {
                    self.entry_contains_account_prefix(&entry, "311").await?
                }
                Some(JournalType::CreditSalesJournal) => {
                    self.entry_contains_account_prefix(&entry, "312").await?
                }
                Some(JournalType::PurchaseJournal) => {
                    self.entry_contains_account_prefix(&entry, "41").await?
                }
                Some(JournalType::PurchaseCostsJournal) => {
                    self.entry_contains_account_prefix(&entry, "221").await?
                }
                _ => true,
            };

            if include {
                dtos.push(self.map_to_dto(entry).await?);
            }
        }

        Ok(dtos)
    }

    pub async fn get_details(&self, id: String) -> Result<JournalEntryDto, AppError> {
        let entry_id = id
            .parse()
            .map_err(|_| AppError::Invalid("معرف قيد غير صالح".into()))?;
        let entry = self
            .repo
            .find_by_id(&entry_id)
            .await?
            .ok_or_else(|| AppError::NotFound("القيد غير موجود".into()))?;

        self.map_to_dto(entry).await
    }

    async fn map_to_dto(
        &self,
        entry: domain::accounting::JournalEntry,
    ) -> Result<JournalEntryDto, AppError> {
        let mut dto = JournalEntryDto::from(entry);

        // Enrich lines with account names and partner names
        for line in &mut dto.lines {
            // Account name
            if let Ok(acc_id) = line.account_id.parse::<AccountId>() {
                if let Ok(Some(acc)) = self.account_repo.find_by_id(&acc_id).await {
                    line.account_name = Some(acc.name_ar);
                    line.account_code = Some(acc.code);
                }
            }
        }

        Ok(dto)
    }

    async fn entry_contains_account_prefix(
        &self,
        entry: &domain::accounting::JournalEntry,
        prefix: &str,
    ) -> Result<bool, AppError> {
        for line in &entry.lines {
            if let Some(acc) = self.account_repo.find_by_id(&line.account_id).await? {
                if acc.code.starts_with(prefix) {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }
}
