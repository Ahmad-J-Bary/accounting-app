use std::sync::Arc;

use domain::accounting::account::Account;
use domain::accounting::MigrationStatus;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;

/// Rejects a P&L (Revenue / Expenses) account from an opening-balance item.
/// Opening balances carry balance-sheet items only; the historical result
/// flows through Retained Earnings / the residual reclassification.
/// Shared by the create (line intake) and post (journal build) paths so the
/// rule cannot drift between the two.
pub fn reject_pl_account(account: &Account) -> Result<(), AppError> {
    use domain::accounting::account::AccountType;
    if matches!(account.account_type, AccountType::Revenue | AccountType::Expenses) {
        return Err(AppError::Invalid(
            "حسابات قائمة الدخل (إيرادات/مصاريف) غير مسموحة في الرصيد الافتتاحي — تُرحَّل النتيجة عبر الأرباح المبقاة"
                .into(),
        ));
    }
    Ok(())
}

/// True while an opening-balance migration setup is "in flight" — i.e. its
/// window is still open (Draft → Approved). The window closes when the
/// migration is Posted (the aggregate opening journal enters the ledger and the
/// company starts operating), Locked, or Cancelled.
///
/// This is the context switch behind the ONE accounting system: while the
/// window is open, module create flows (customer/supplier/partner/capital)
/// record balances as part of the migration instead of posting their own
/// independent opening journals, and a new-company cash capital contribution
/// is not allowed. After the window closes the company behaves exactly like a
/// new company.
pub async fn opening_window_active(
    repo: &Arc<dyn OpeningMigrationRepository>,
) -> Result<bool, AppError> {
    let migrations = repo.list().await?;
    Ok(migrations.iter().any(|m| matches!(
        m.status,
        MigrationStatus::Draft
            | MigrationStatus::Validated
            | MigrationStatus::Approved
    )))
}
