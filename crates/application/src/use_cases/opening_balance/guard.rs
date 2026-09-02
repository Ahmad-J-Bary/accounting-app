use std::sync::Arc;

use domain::accounting::account::Account;
use domain::accounting::MigrationStatus;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::settings_repository::SettingsRepository;

use super::create::START_MODE_EXISTING;

/// Rejects a P&L (Revenue / Expenses) account from an opening-balance item.
/// Opening balances carry balance-sheet items only; the historical result
/// flows through Retained Earnings / the residual reclassification.
/// Shared by the create (line intake) and post (journal build) paths so the
/// rule cannot drift between the two.
pub fn reject_pl_account(account: &Account) -> Result<(), AppError> {
    use domain::accounting::account::AccountType;
    if matches!(
        account.account_type,
        AccountType::Revenue | AccountType::Expenses
    ) {
        return Err(AppError::Invalid(
            "حسابات قائمة الدخل (إيرادات/مصاريف) غير مسموحة في الرصيد الافتتاحي — تُرحَّل النتيجة عبر الأرباح المبقاة"
                .into(),
        ));
    }
    Ok(())
}

/// True while an opening-balance migration setup is "in flight" — i.e. its
/// window is still open. The window closes only when every migration reaches
/// `Locked` or is `Cancelled`; it stays open through Posting (Draft → Validated
/// → Approved → Posted) so the company's opening position is complete before it
/// starts operating (the single canonical opening GL posting).
///
/// This is the context switch behind the ONE accounting system: while the
/// window is open, module create flows (customer/supplier/partner/capital/
/// material/asset/account) record balances as part of the migration instead of
/// posting their own independent opening journals, and a new-company cash
/// capital contribution is not allowed. After the window closes the company
/// behaves exactly like a new company.
pub async fn opening_window_active(
    repo: &Arc<dyn OpeningMigrationRepository>,
) -> Result<bool, AppError> {
    let migrations = repo.list().await?;
    Ok(migrations.iter().any(|m| {
        !matches!(
            m.status,
            MigrationStatus::Cancelled | MigrationStatus::Locked
        )
    }))
}

/// True once an EXISTING company's opening lifecycle is sealed — any migration
/// has reached Locked. After that the opening workflow is closed for good and
/// becomes read-only history (no new writes, no new migrations).
pub async fn opening_lifecycle_closed(
    repo: &Arc<dyn OpeningMigrationRepository>,
) -> Result<bool, AppError> {
    let migrations = repo.list().await?;
    Ok(migrations
        .iter()
        .any(|m| m.status == MigrationStatus::Locked))
}

/// Backend capability guard for opening-workflow WRITES (persisting the
/// wizard draft, creating a migration, …): only legal while the lifecycle is
/// still open — an EXISTING company with no Locked migration yet. NEW companies
/// never touch the workflow; once closed (a Locked migration exists) the
/// workflow is sealed and every write is rejected so the API cannot be abused
/// by direct calls even though the UI hides the pages.
pub async fn assert_opening_workflow_writable(
    settings_repo: &Arc<dyn SettingsRepository>,
    migration_repo: &Arc<dyn OpeningMigrationRepository>,
) -> Result<(), AppError> {
    let settings = settings_repo.get().await?;
    if settings.accounting_start_mode != START_MODE_EXISTING {
        return Err(AppError::Forbidden(
            "وضع بدء المحاسبة مضبوط على «شركة جديدة» — لا يوجد رصيد افتتاحي يمكن تعديله؛ \
             استخدم الوضع «شركة قائمة تبدأ الاستخدام» أولاً"
                .into(),
        ));
    }
    if opening_lifecycle_closed(migration_repo).await? {
        return Err(AppError::Forbidden(
            "الرصيد الافتتاحي للشركة أُقفل نهائياً — انتهى وقت تجهيز الرصيد الافتتاحي \
             ولا يُسمح بأي تعديلات أو إنشاء ترحيلات جديدة"
                .into(),
        ));
    }
    Ok(())
}
