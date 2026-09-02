use std::str::FromStr;
use std::sync::Arc;

use domain::assets::FixedAssetId;
use domain::shared::ids::{AccountId, CustomerId, MaterialId, SupplierId};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::opening_item_repository::OpeningItemRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::use_cases::opening_balance::types::{
    OpeningItemsDto, SaveOpeningItemsCommand, KIND_AP, KIND_AR, KIND_BANK, KIND_FIXED_ASSET,
    KIND_INVENTORY, KIND_LOAN,
};

/// Persists the sub-ledger item links (AR / AP / Inventory / Fixed Assets /
/// Bank / Loan) for an opening-balance migration. Every item references a REAL
/// entity created through the same module; the reference is validated before it
/// is stored so the migration can never point at a nonexistent customer/
/// supplier/material/asset/ledger-account. This is the single source of the
/// sub-ledger reconciliation input.
pub struct SaveOpeningItemsUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    item_repo: Arc<dyn OpeningItemRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    asset_repo: Arc<dyn AssetRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl SaveOpeningItemsUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        item_repo: Arc<dyn OpeningItemRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        asset_repo: Arc<dyn AssetRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self {
            migration_repo,
            item_repo,
            customer_repo,
            supplier_repo,
            material_repo,
            asset_repo,
            account_repo,
        }
    }

    pub async fn execute(&self, cmd: SaveOpeningItemsCommand) -> Result<OpeningItemsDto, AppError> {
        let migration = self
            .migration_repo
            .find_by_id(&cmd.migration_id)
            .await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        // Editing items is only allowed while the migration is still editable.
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

        // Every referenced entity must exist in its own real module. This is the
        // guard that makes the sub-ledger a link to real entities instead of a
        // parallel free-text store.
        for it in &cmd.items {
            match it.kind.as_str() {
                KIND_AR => {
                    let id = CustomerId::from_str(&it.entity_id)
                        .map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;
                    self.customer_repo.find_by_id(&id).await?.ok_or_else(|| {
                        AppError::NotFound(format!("العميل غير موجود: {}", it.entity_id))
                    })?;
                }
                KIND_AP => {
                    let id = SupplierId::from_str(&it.entity_id)
                        .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;
                    self.supplier_repo.find_by_id(&id).await?.ok_or_else(|| {
                        AppError::NotFound(format!("المورد غير موجود: {}", it.entity_id))
                    })?;
                }
                KIND_INVENTORY => {
                    let id = MaterialId::from_str(&it.entity_id)
                        .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
                    self.material_repo.find_by_id(&id).await?.ok_or_else(|| {
                        AppError::NotFound(format!("المادة غير موجودة: {}", it.entity_id))
                    })?;
                }
                KIND_FIXED_ASSET => {
                    let id = FixedAssetId(
                        uuid::Uuid::parse_str(&it.entity_id)
                            .map_err(|_| AppError::Invalid("معرف الأصل الثابت غير صالح".into()))?,
                    );
                    self.asset_repo
                        .find_asset_by_id(&id)
                        .await?
                        .ok_or_else(|| {
                            AppError::NotFound(format!("الأصل الثابت غير موجود: {}", it.entity_id))
                        })?;
                }
                KIND_BANK | KIND_LOAN => {
                    let id = AccountId::from_str(&it.entity_id)
                        .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
                    self.account_repo.find_by_id(&id).await?.ok_or_else(|| {
                        AppError::NotFound(format!("الحساب غير موجود: {}", it.entity_id))
                    })?;
                }
                _ => {
                    return Err(AppError::Invalid(format!("نوع بند غير معروف: {}", it.kind)));
                }
            }
        }

        self.item_repo
            .replace_items(&cmd.migration_id, &cmd.items)
            .await?;
        Ok(OpeningItemsDto { items: cmd.items })
    }
}
