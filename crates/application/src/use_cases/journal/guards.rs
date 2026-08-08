use domain::accounting::journal_entry::{JournalEntry, JournalEntryStatus};
use crate::errors::AppError;

/// Guards a destructive/rewrite operation that would erase part of posted
/// financial history. Only draft entries may be deleted or rewritten directly;
/// posted, reversed and cancelled entries must be handled through a reversal.
///
/// Returns Ok(()) when every entry in `entries` is still a draft. The first
/// non-draft entry produces a Forbidden error carrying the entry number so the
/// caller can surface a clear message to the user.
pub fn ensure_deletable(entries: &[JournalEntry]) -> Result<(), AppError> {
    for entry in entries {
        match entry.status {
            JournalEntryStatus::Draft => {}
            JournalEntryStatus::Posted => {
                return Err(AppError::Forbidden(format!(
                    "لا يمكن حذف أو تعديل القيد المرحّل ({})؛ استخدم قيد التراجع (Reversal)",
                    entry.entry_number
                )));
            }
            JournalEntryStatus::Reversed => {
                return Err(AppError::Forbidden(format!(
                    "لا يمكن حذف أو تعديل القيد الملغى ({})؛ القيد جزء من السجل المحاسبي",
                    entry.entry_number
                )));
            }
            JournalEntryStatus::Cancelled => {
                return Err(AppError::Forbidden(format!(
                    "لا يمكن حذف أو تعديل القيد الملغي ({})",
                    entry.entry_number
                )));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::journal_entry::{JournalLine, JournalType};
    use chrono::Utc;
    use domain::shared::ids::{AccountId, JournalEntryId};
    use domain::shared::monetary_amount::MonetaryAmount;
    use domain::shared::money::Money;
    use domain::shared::currency::Currency;
    use uuid::Uuid;

    fn currency() -> Currency {
        Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
    }

    fn line(account: AccountId) -> JournalLine {
        let c = currency();
        JournalLine {
            account_id: account,
            partner_id: None,
            debit: MonetaryAmount::new(Money::new(rust_decimal::Decimal::ONE, c.clone()), rust_decimal::Decimal::ONE),
            credit: MonetaryAmount::zero(c),
            description: "مدين".to_string(),
        }
    }

fn entry(number: &str, status: JournalEntryStatus) -> JournalEntry {
        let account = AccountId(Uuid::new_v4());
        JournalEntry {
            id: JournalEntryId(Uuid::new_v4()),
            entry_number: number.to_string(),
            journal_type: JournalType::GeneralJournal,
            source_id: None,
            source_type: None,
            reversal_of_entry_id: None,
            lines: vec![line(account)],
            entry_date: Utc::now(),
            description: "قيد اختبار".to_string(),
            status,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            posted_at: None,
            reversed_at: None,
        }
    }

    #[test]
    fn drafts_are_deletable() {
        let entries = vec![entry("D-1", JournalEntryStatus::Draft)];
        assert!(ensure_deletable(&entries).is_ok());
        assert!(ensure_deletable(&[]).is_ok());
    }

    #[test]
    fn posted_entry_blocks_deletion() {
        let entries = vec![entry("P-1", JournalEntryStatus::Posted)];
        let err = ensure_deletable(&entries).unwrap_err();
        match err {
            AppError::Forbidden(msg) => assert!(msg.contains("P-1")),
            other => panic!("expected Forbidden, got {:?}", other),
        }
    }

    #[test]
    fn reversed_entry_blocks_deletion() {
        let entries = vec![entry("R-1", JournalEntryStatus::Reversed)];
        assert!(ensure_deletable(&entries).is_err());
    }

    #[test]
    fn cancelled_entry_blocks_deletion() {
        let entries = vec![entry("C-1", JournalEntryStatus::Cancelled)];
        assert!(ensure_deletable(&entries).is_err());
    }

    #[test]
    fn single_non_draft_poisons_the_batch() {
        let entries = vec![
            entry("D-2", JournalEntryStatus::Draft),
            entry("P-2", JournalEntryStatus::Posted),
        ];
        assert!(ensure_deletable(&entries).is_err());
    }
}
