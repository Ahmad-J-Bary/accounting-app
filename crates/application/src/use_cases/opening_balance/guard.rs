use std::sync::Arc;

use domain::accounting::MigrationStatus;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;

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
