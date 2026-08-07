use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::opening_detail_repository::OpeningDetailRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::{OpeningDetailsDto, SaveOpeningDetailsCommand};

/// Persists the sub-ledger detail items (AR / AP / Inventory / Fixed Assets)
/// for an opening-balance migration. Replaces all four categories atomically.
pub struct SaveOpeningDetailsUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    detail_repo: Arc<dyn OpeningDetailRepository>,
}

impl SaveOpeningDetailsUseCase {
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        detail_repo: Arc<dyn OpeningDetailRepository>,
    ) -> Self {
        Self { migration_repo, detail_repo }
    }

    pub async fn execute(&self, cmd: SaveOpeningDetailsCommand) -> Result<OpeningDetailsDto, AppError> {
        let migration = self.migration_repo.find_by_id(&cmd.migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        // Editing details is only allowed while the migration is still editable.
        if matches!(
            migration.status,
            domain::accounting::MigrationStatus::Posted
                | domain::accounting::MigrationStatus::Locked
                | domain::accounting::MigrationStatus::Cancelled
        ) {
            return Err(AppError::Forbidden(
                "لا يمكن تعديل تفاصيل الترحيل بعد نشره أو قفله".into(),
            ));
        }

        let details = OpeningDetailsDto {
            customer_items: cmd.customer_items,
            supplier_items: cmd.supplier_items,
            inventory_items: cmd.inventory_items,
            fixed_assets: cmd.fixed_assets,
        };

        self.detail_repo.replace_details(&cmd.migration_id, &details).await?;
        Ok(details)
    }
}