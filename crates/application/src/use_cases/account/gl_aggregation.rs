use crate::dto::account_dto::GlAccountAggregationDto;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use std::sync::Arc;

pub struct GlAccountAggregationUseCase {
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl GlAccountAggregationUseCase {
    pub fn new(
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self {
            journal_repo,
            account_repo,
        }
    }

    pub async fn execute(&self) -> Result<GlAccountAggregationDto, AppError> {
        let agg_rows = self.journal_repo.aggregate_by_account().await?;

        let account_ids: Vec<_> = agg_rows.iter().map(|r| r.account_id).collect();
        let accounts = self.account_repo.find_by_ids(&account_ids).await?;

        Ok(GlAccountAggregationDto::from_rows(agg_rows, accounts))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockAccountRepository, MockJournalRepository};
    use domain::accounting::{JournalEntry, JournalEntryStatus, JournalLine, JournalType};
    use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
    use domain::shared::{AccountId, Currency, MonetaryAmount, Money};
    use rust_decimal_macros::dec;
    use std::sync::Arc;
    use uuid::Uuid;

    fn make_account(id: AccountId, code: &str, name: &str) -> Account {
        let currency = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        Account {
            id,
            code: code.to_string(),
            name_ar: name.to_string(),
            name_en: name.to_string(),
            account_type: AccountType::Assets,
            parent_id: None,
            category: AccountCategory::Detail,
            level: 1,
            opening_balance: dec!(0),
            balance: dec!(0),
            notes: None,
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: None,
            debit: dec!(0),
            credit: dec!(0),
            currency,
            exchange_rate: dec!(1),
            purpose: AccountPurpose::General,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    fn make_entry(
        status: JournalEntryStatus,
        lines: Vec<JournalLine>,
    ) -> JournalEntry {
        let mut entry = JournalEntry::new(
            "1".to_string(),
            JournalType::GeneralJournal,
            lines,
            chrono::Utc::now(),
            "test".to_string(),
            None,
        )
        .unwrap();
        entry.status = status;
        entry
    }

    #[tokio::test]
    async fn aggregation_only_includes_posted_entries() {
        let journal_repo = Arc::new(MockJournalRepository::default());
        let account_repo = Arc::new(MockAccountRepository::default());

        let acc1 = AccountId(Uuid::new_v4());
        let acc2 = AccountId(Uuid::new_v4());
        let base = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);

        let debit100 = MonetaryAmount::new(Money::new(dec!(100), base.clone()), dec!(1));
        let credit100 = MonetaryAmount::new(Money::new(dec!(100), base.clone()), dec!(1));
        let zero = MonetaryAmount::zero(base);

        let posted = make_entry(
            JournalEntryStatus::Posted,
            vec![
                JournalLine::new(acc1, debit100.clone(), zero.clone(), "debit".into()),
                JournalLine::new(acc2, zero.clone(), credit100.clone(), "credit".into()),
            ],
        );
        let draft = make_entry(
            JournalEntryStatus::Draft,
            vec![
                JournalLine::new(acc1, debit100.clone(), zero.clone(), "draft debit".into()),
                JournalLine::new(acc2, zero.clone(), credit100.clone(), "draft credit".into()),
            ],
        );

        {
            let mut store = journal_repo.entries.lock().unwrap();
            store.push(posted);
            store.push(draft);
        }

        let use_case = GlAccountAggregationUseCase::new(journal_repo, account_repo);
        let result = use_case.execute().await.unwrap();

        // Only posted entry's lines should be aggregated
        assert_eq!(result.lines.len(), 2);
        let acc1_line = result.lines.iter().find(|l| l.account_id == acc1.0.to_string()).unwrap();
        assert_eq!(acc1_line.total_debit_base, "100");
        assert_eq!(acc1_line.total_credit_base, "0");
    }

    #[tokio::test]
    async fn aggregation_excludes_reversal_pairs() {
        let journal_repo = Arc::new(MockJournalRepository::default());
        let account_repo = Arc::new(MockAccountRepository::default());

        let acc = AccountId(Uuid::new_v4());
        let base = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        let debit200 = MonetaryAmount::new(Money::new(dec!(200), base.clone()), dec!(1));
        let zero = MonetaryAmount::zero(base.clone());

        let mut posted = make_entry(
            JournalEntryStatus::Posted,
            vec![JournalLine::new(acc, debit200.clone(), zero.clone(), "original".into())],
        );
        posted.reversal_of_entry_id = Some(domain::shared::JournalEntryId(Uuid::new_v4()));

        {
            let mut store = journal_repo.entries.lock().unwrap();
            store.push(posted);
        }

        let use_case = GlAccountAggregationUseCase::new(journal_repo, account_repo);
        let result = use_case.execute().await.unwrap();

        // Reversal pair entries should be excluded
        assert!(result.lines.is_empty());
    }

    #[tokio::test]
    async fn aggregation_enriches_account_names() {
        let journal_repo = Arc::new(MockJournalRepository::default());
        let account_repo = Arc::new(MockAccountRepository::default());

        let acc = AccountId(Uuid::new_v4());
        let base = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        let debit50 = MonetaryAmount::new(Money::new(dec!(50), base.clone()), dec!(1));
        let zero = MonetaryAmount::zero(base.clone());

        let posted = make_entry(
            JournalEntryStatus::Posted,
            vec![JournalLine::new(acc, debit50.clone(), zero.clone(), "test".into())],
        );

        {
            let mut store = journal_repo.entries.lock().unwrap();
            store.push(posted);
        }
        {
            let mut accounts = account_repo.accounts.lock().unwrap();
            accounts.push(make_account(acc, "1101", "البنك المركزي"));
        }

        let use_case = GlAccountAggregationUseCase::new(journal_repo, account_repo);
        let result = use_case.execute().await.unwrap();

        assert_eq!(result.lines.len(), 1);
        assert_eq!(result.lines[0].account_code.as_deref(), Some("1101"));
        assert_eq!(result.lines[0].account_name.as_deref(), Some("البنك المركزي"));
        assert_eq!(result.lines[0].balance_base, "50");
    }
}
