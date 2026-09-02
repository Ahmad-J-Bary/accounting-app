use chrono::Utc;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::money::Money;
use domain::shared::MonetaryAmount;
use rust_decimal::Decimal;
use std::sync::Arc;

use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::use_cases::account::error::AccountUseCaseError;

/// Books (or refreshes in place) the account's single per-account
/// `AccountOpeningBalance` journal against the opening balance equity account
/// (53). Shared by account create (initial opening) and account update
/// (opening-balance edit) so both paths book structurally identical journals.
///
/// One journal per account, keyed by source_id = the account's own id: editing
/// the opening balance re-books the CURRENT total on the account's seal-12
/// normal-balance side and the repository updates the existing row in place
/// (see `insert_entry`'s `UNIQUE(source_type, source_id)` conflict path), so
/// the ledger always reflects the account's current opening — exactly what the
/// posted-journal-driven tree needs.
///
/// `amount` is the positive magnitude; `debit_nature` selects the side the
/// account line lands on (true = Dr account / Cr equity).
pub async fn book_opening_journal(
    account: &Account,
    amount: Decimal,
    debit_nature: bool,
    account_repo: &Arc<dyn AccountRepository>,
    journal_repo: &Arc<dyn JournalEntryRepository>,
) -> Result<(), AccountUseCaseError> {
    if amount <= Decimal::ZERO {
        return Ok(());
    }

    let fx_rate = if account.currency.is_base {
        Decimal::ONE
    } else if account.exchange_rate > Decimal::ZERO {
        account.exchange_rate
    } else {
        Decimal::ONE
    };

    let amount_ma = MonetaryAmount::new(Money::new(amount, account.currency.clone()), fx_rate);
    let zero_ma = MonetaryAmount::zero(account.currency.clone());

    let equity_account = account_repo
        .find_by_code("53")
        .await
        .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
        .ok_or_else(|| {
            AccountUseCaseError::Validation("حساب الرصيد الافتتاحي غير موجود: 53".into())
        })?;

    let mut lines = Vec::new();
    if debit_nature {
        lines.push(JournalLine::new(
            account.id,
            amount_ma.clone(),
            zero_ma.clone(),
            format!("رصيد افتتاحي مدين للحساب: {}", account.name_ar),
        ));
        lines.push(JournalLine::new(
            equity_account.id,
            zero_ma,
            amount_ma,
            format!("رصيد افتتاحي للحساب: {}", account.name_ar),
        ));
    } else {
        lines.push(JournalLine::new(
            equity_account.id,
            amount_ma.clone(),
            zero_ma.clone(),
            format!("رصيد افتتاحي دائن للحساب: {}", account.name_ar),
        ));
        lines.push(JournalLine::new(
            account.id,
            zero_ma,
            amount_ma,
            format!("رصيد افتتاحي للحساب: {}", account.name_ar),
        ));
    }

    let next_number = journal_repo
        .get_next_entry_number()
        .await
        .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

    let mut entry = JournalEntry::new(
        next_number,
        JournalType::AccountOpeningBalance,
        lines,
        Utc::now(),
        format!("قيد افتتاح رصيد الحساب: {}", account.name_ar),
        Some(account.id.to_string()),
    )
    .map_err(|e| AccountUseCaseError::Validation(e.to_string()))?;

    entry
        .post()
        .map_err(|e| AccountUseCaseError::Validation(e.to_string()))?;

    journal_repo
        .save(&entry)
        .await
        .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

    Ok(())
}
