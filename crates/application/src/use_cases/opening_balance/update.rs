use std::str::FromStr;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use domain::accounting::{MigrationStatus, OpeningBalanceLine};
use domain::shared::ids::AccountId;
use rust_decimal::Decimal;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::settings_repository::SettingsRepository;
use crate::use_cases::opening_balance::create::START_MODE_EXISTING;
use crate::use_cases::opening_balance::types::{
    OpeningMigrationDto, UpdateOpeningMigrationLinesCommand,
};

/// Replaces the lines of an existing, still-editable opening migration. This is
/// the back-navigation path of the wizard: after a failed/early validation the
/// accountant goes back to the review step, fixes a section and saves again —
/// the same migration is updated (lines replaced, status reset to Draft) instead
/// of failing the duplicate-cutover guard of the create use case.
pub struct UpdateOpeningMigrationLinesUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    account_repo: Arc<dyn AccountRepository>,
    settings_repo: Arc<dyn SettingsRepository>,
}

impl UpdateOpeningMigrationLinesUseCase {
    pub fn new(
        repo: Arc<dyn OpeningMigrationRepository>,
        account_repo: Arc<dyn AccountRepository>,
        settings_repo: Arc<dyn SettingsRepository>,
    ) -> Self {
        Self {
            repo,
            account_repo,
            settings_repo,
        }
    }

    pub async fn execute(
        &self,
        cmd: UpdateOpeningMigrationLinesCommand,
    ) -> Result<OpeningMigrationDto, AppError> {
        let settings = self.settings_repo.get().await?;
        if settings.accounting_start_mode != START_MODE_EXISTING {
            return Err(AppError::Forbidden(
                "وضع بدء المحاسبة مضبوط على «شركة جديدة» — لا يمكن تعديل رصيد افتتاحي".into(),
            ));
        }

        let mut migration = self
            .repo
            .find_by_id(&cmd.migration_id)
            .await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        if matches!(
            migration.status,
            MigrationStatus::Posted | MigrationStatus::Locked | MigrationStatus::Cancelled
        ) {
            return Err(AppError::Forbidden(
                "لا يمكن تعديل بنود الترحيل بعد نشره أو قفله أو إلغائه".into(),
            ));
        }

        let cutover = DateTime::parse_from_rfc3339(&cmd.cutover_date)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|_| AppError::Invalid("تاريخ الترحيل غير صالح".into()))?;
        migration.cutover_date = cutover;

        let mut lines = Vec::with_capacity(cmd.lines.len());
        for l in cmd.lines {
            let amount = Decimal::from_str(&l.amount)
                .map_err(|_| AppError::Invalid("قيمة البند غير صالحة".into()))?;
            let account_id = AccountId::from_str(&l.account_id)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;

            let account = self
                .account_repo
                .find_by_id(&account_id)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {}", account_id)))?;
            super::guard::reject_pl_account(&account)?;

            lines.push(OpeningBalanceLine {
                account_id,
                amount,
                description: l.description,
            });
        }

        migration.replace_lines(lines)?;
        migration.set_notes(cmd.notes);
        migration.set_source(None, cmd.source_system, cmd.source_reference);
        self.repo.update(&migration).await?;

        Ok(OpeningMigrationDto(migration))
    }
}
