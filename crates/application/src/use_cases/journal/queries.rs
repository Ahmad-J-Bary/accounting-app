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

        // Use journal_type as the filter key (not account prefix).
        //   GeneralJournal → no SQL filter (show ALL entries, it's the general journal)
        //   CashJournal → no SQL filter, then post-filter for cash-related types
        //   All others → SQL filters by exact journal_type
        let repo_journal_type = match journal_type {
            Some(JournalType::GeneralJournal) | Some(JournalType::CashJournal) => None,
            _ => journal_type,
        };

        let entries = self
            .repo
            .list_with_filters(from, to, repo_journal_type, acc_id, part_id, status_enum)
            .await?;

        let mut dtos = Vec::new();
        for entry in entries {
            let include = match journal_type {
                Some(JournalType::CashJournal) => matches!(
                    entry.journal_type,
                    JournalType::CashJournal
                        | JournalType::CashReceipt
                        | JournalType::CashPayment
                        | JournalType::CashOpeningBalance
                        | JournalType::AccountOpeningBalance
                ),
                // For any non-GeneralJournal / non-CashJournal filter, only include
                // entries whose journal_type matches exactly. This automatically
                // excludes CashOpeningBalance from unrelated filters.
                Some(jt) if jt != JournalType::GeneralJournal => entry.journal_type == jt,
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

}
