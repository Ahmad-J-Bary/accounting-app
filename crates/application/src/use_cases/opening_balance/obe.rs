use std::sync::Arc;

use rust_decimal::Decimal;

use domain::shared::ids::AccountId;

use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;

/// Chart code of the Opening Balance Equity control account (رصيد افتتاحي). The
/// residual of a migration sits here before it is reclassified to the chosen
/// equity account; after `residual_classification:{id}` the account nets to
/// zero.
pub const OPENING_EQUITY_ACCOUNT_CODE: &str = "53";

/// Source-id of the posting journal that books an opened migration.
pub fn opening_source_id(migration_id: &str) -> String {
    format!("opening_balance:{migration_id}")
}

/// Source-id of the residual reclassification journal that clears account 53
/// into the accountant-chosen classification account.
pub fn residual_source_id(migration_id: &str) -> String {
    format!("residual_classification:{migration_id}")
}

/// Net debit of the Opening Balance Equity (53) across every journal that
/// belongs to the migration: the posting journal (`opening_balance:{id}`) and
/// any residual reclassification journal (`residual_classification:{id}`). A
/// reclassified migration nets to zero because the residual journal's OBE leg
/// cancels the posting journal's OBE leg.
pub async fn obe_control_net(
    journal_repo: &Arc<dyn JournalEntryRepository>,
    obe_account_id: Option<AccountId>,
    migration_id: &str,
) -> Result<Decimal, AppError> {
    let Some(obe_account_id) = obe_account_id else {
        return Ok(Decimal::ZERO);
    };
    let mut balance = Decimal::ZERO;
    for source_id in [
        opening_source_id(migration_id),
        residual_source_id(migration_id),
    ] {
        if let Some(entry) = journal_repo.find_by_source_id(&source_id).await? {
            for line in &entry.lines {
                if line.account_id == obe_account_id {
                    balance += line.debit.base_amount - line.credit.base_amount;
                }
            }
        }
    }
    Ok(balance)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
    use domain::accounting::JournalEntryStatus;
    use domain::shared::{Currency, MonetaryAmount};
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    use crate::mocks::MockJournalRepository;
    use crate::ports::journal_entry_repository::JournalEntryRepository;

    fn currency() -> Currency {
        Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false)
    }

    #[tokio::test]
    async fn obe_net_is_zero_after_residual_reclassification() {
        let repo: Arc<dyn JournalEntryRepository> = Arc::new(MockJournalRepository::new());
        let obe = AccountId(Uuid::new_v4());
        let target = AccountId(Uuid::new_v4());
        let mig = "mig-obe-net";

        // Posting journal: Dr cash 100 / Cr 53 (45) / Cr other 55 — OBE nets
        // to −45 (credit residual) before the reclassification.
        let posting = JournalEntry::new(
            "OBE-1".to_string(),
            JournalType::AccountOpeningBalance,
            vec![
                JournalLine::new(
                    obe,
                    MonetaryAmount::zero(currency()),
                    MonetaryAmount::from_base(dec!(45), currency()),
                    "r".into(),
                ),
                JournalLine::new(
                    target,
                    MonetaryAmount::zero(currency()),
                    MonetaryAmount::from_base(dec!(55), currency()),
                    "r".into(),
                ),
            ],
            Utc::now(),
            "post".into(),
            Some(opening_source_id(mig)),
        )
        .unwrap();
        let mut posting = posting;
        posting.status = JournalEntryStatus::Posted;
        repo.save(&posting).await.unwrap();

        assert_eq!(
            obe_control_net(&repo, Some(obe), mig).await.unwrap(),
            dec!(-45)
        );

        // Residual journal cancels the OBE leg: Dr 53 45 / Cr target 45.
        let residual = JournalEntry::new(
            "OBE-2".to_string(),
            JournalType::GeneralJournal,
            vec![
                JournalLine::new(
                    obe,
                    MonetaryAmount::from_base(dec!(45), currency()),
                    MonetaryAmount::zero(currency()),
                    "r".into(),
                ),
                JournalLine::new(
                    target,
                    MonetaryAmount::zero(currency()),
                    MonetaryAmount::from_base(dec!(45), currency()),
                    "r".into(),
                ),
            ],
            Utc::now(),
            "residual".into(),
            Some(residual_source_id(mig)),
        )
        .unwrap();
        let mut residual = residual;
        residual.status = JournalEntryStatus::Posted;
        repo.save(&residual).await.unwrap();

        let net = obe_control_net(&repo, Some(obe), mig).await.unwrap();
        assert_eq!(net, dec!(0), "reclassified migration nets 53 to zero");
    }
}
