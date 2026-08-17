use crate::dto::journal_entry_dto::JournalEntryDto;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use chrono::{DateTime, NaiveDate, TimeZone, Utc};
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
        exclude_reversal_pairs: Option<bool>,
    ) -> Result<Vec<JournalEntryDto>, AppError> {
        let from = from_date.and_then(|d| parse_date_bound(&d, false));
        let to = to_date.and_then(|d| parse_date_bound(&d, true));
        let acc_id = account_id.and_then(|id| id.parse::<AccountId>().ok());
        let part_id = partner_id.and_then(|id| Uuid::parse_str(&id).ok());
        let exclude_reversal_pairs = exclude_reversal_pairs.unwrap_or(false);
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
            Some(JournalType::GeneralJournal) 
            | Some(JournalType::CashJournal) 
            | Some(JournalType::PurchaseJournal) => None,
            _ => journal_type,
        };

        let entries = self
            .repo
            .list_with_filters(from, to, repo_journal_type, acc_id, part_id, status_enum, exclude_reversal_pairs)
            .await?;

        let mut dtos = Vec::new();
        for entry in entries {
            let include = match journal_type {
                Some(JournalType::GeneralJournal) => true,
                Some(JournalType::CashJournal) => matches!(
                    entry.journal_type,
                    JournalType::CashJournal
                        | JournalType::CashReceipt
                        | JournalType::CashPayment
                        | JournalType::CashOpeningBalance
                        | JournalType::AccountOpeningBalance
                ),
                Some(JournalType::PurchaseJournal) => matches!(
                    entry.journal_type,
                    JournalType::PurchaseJournal | JournalType::PurchaseCostsJournal
                ),
                Some(JournalType::PurchaseCostsJournal) => {
                    entry.journal_type == JournalType::PurchaseCostsJournal
                }
                Some(jt) => entry.journal_type == jt,
                None => true,
            };

            if include {
                dtos.push(self.map_to_dto(entry).await?);
            }
        }

        Ok(dtos)
    }

    /// Report-scoped listing: returns ONLY posted journal entries (optionally
    /// narrowed by account / partner). Drafts and cancelled entries must never
    /// reach financial statements — an unposted entry is not part of the GL.
    /// Routing every report consumer through this method (instead of letting
    /// each call site pass a status filter) prevents Draft leakage regressions.
    pub async fn execute_posted(
        &self,
        from_date: Option<String>,
        to_date: Option<String>,
        account_id: Option<String>,
        partner_id: Option<String>,
    ) -> Result<Vec<JournalEntryDto>, AppError> {
        let from = from_date.and_then(|d| parse_date_bound(&d, false));
        let to = to_date.and_then(|d| parse_date_bound(&d, true));
        let acc_id = account_id.and_then(|id| id.parse::<AccountId>().ok());
        let part_id = partner_id.and_then(|id| Uuid::parse_str(&id).ok());

        let entries = self
            .repo
            .list_with_filters(from, to, None, acc_id, part_id, Some(JournalEntryStatus::Posted), false)
            .await?;

        let mut dtos = Vec::with_capacity(entries.len());
        for entry in entries {
            dtos.push(self.map_to_dto(entry).await?);
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
                    line.account_purpose = Some(acc.purpose.to_str().to_string());
                }
            }
        }

        Ok(dto)
    }

}

fn parse_date_bound(value: &str, end_of_day: bool) -> Option<DateTime<Utc>> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
        return Some(dt.with_timezone(&Utc));
    }

    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        if end_of_day {
            let last_moment = date.and_hms_opt(23, 59, 59)?;
            return Some(Utc.from_utc_datetime(&last_moment));
        }
        let start_of_day = date.and_hms_opt(0, 0, 0)?;
        return Some(Utc.from_utc_datetime(&start_of_day));
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockAccountRepository, MockJournalRepository};
    use domain::accounting::{JournalEntry, JournalEntryStatus, JournalLine, JournalType};
    use domain::shared::{AccountId, Currency, MonetaryAmount, Money};
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    fn balanced_entry(number: &str, desc: &str, account_id: AccountId) -> JournalEntry {
        let base = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
        let amount = MonetaryAmount::new(Money::new(dec!(100), base.clone()), dec!(1));
        let zero = MonetaryAmount::zero(base);
        JournalEntry::new(
            number.to_string(),
            JournalType::GeneralJournal,
            vec![
                JournalLine::new(account_id, amount.clone(), zero.clone(), desc.to_string()),
                JournalLine::new(account_id, zero, amount, desc.to_string()),
            ],
            chrono::Utc::now(),
            desc.to_string(),
            None,
        )
        .unwrap()
    }

    #[tokio::test]
    async fn execute_posted_returns_only_posted_entries() {
        let journal_repo = Arc::new(MockJournalRepository::default());
        let account_repo = Arc::new(MockAccountRepository::default());
        let account = AccountId(Uuid::new_v4());

        let draft = balanced_entry("1", "draft-fa-opening", account);
        let mut posted = balanced_entry("2", "posted-migration", account);
        posted.post().unwrap();
        let mut reversed = balanced_entry("3", "reversed", account);
        reversed.post().unwrap();
        reversed.reverse().unwrap();
        let mut cancelled = balanced_entry("4", "cancelled", account);
        cancelled.status = JournalEntryStatus::Cancelled;

        journal_repo
            .entries
            .lock()
            .unwrap()
            .extend([draft.clone(), posted.clone(), reversed.clone(), cancelled.clone()]);

        let use_case = ListJournalEntriesUseCase::new(journal_repo.clone(), account_repo.clone());
        let result = use_case.execute_posted(None, None, None, None).await.unwrap();

        assert_eq!(result.len(), 1, "only the Posted entry reaches reports");
        assert_eq!(result[0].description, "posted-migration");
        assert_ne!(result[0].description, "draft-fa-opening",
            "a Draft FA opening journal must never reach the reports");
    }
}
