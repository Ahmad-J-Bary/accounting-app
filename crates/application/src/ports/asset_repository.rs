use async_trait::async_trait;
use domain::assets::{FixedAsset, FixedAssetId, AssetCategory, AssetMovement, DepreciationSchedule};
use domain::accounting::journal_entry::JournalEntry;
use domain::accounting::account::Account;
use crate::errors::AppError;
use uuid::Uuid;

#[async_trait]
pub trait AssetRepository: Send + Sync {
    async fn save_asset(&self, asset: &FixedAsset) -> Result<(), AppError>;
    async fn find_asset_by_id(&self, id: &FixedAssetId) -> Result<Option<FixedAsset>, AppError>;
    async fn list_assets(&self) -> Result<Vec<FixedAsset>, AppError>;
    
    async fn save_category(&self, category: &AssetCategory) -> Result<(), AppError>;
    async fn list_categories(&self, asset_type: domain::assets::AssetType) -> Result<Vec<AssetCategory>, AppError>;
    
    async fn save_movement(&self, movement: &AssetMovement) -> Result<(), AppError>;
    async fn list_movements_by_asset(&self, asset_id: &Uuid) -> Result<Vec<AssetMovement>, AppError>;
    async fn list_all_movements(&self) -> Result<Vec<AssetMovement>, AppError>;
    
    async fn save_depreciation_schedule(&self, schedule: &DepreciationSchedule) -> Result<(), AppError>;
    async fn get_depreciation_schedule(&self, asset_id: &Uuid) -> Result<Vec<DepreciationSchedule>, AppError>;

    async fn delete_asset(&self, id: &FixedAssetId) -> Result<(), AppError>;
    async fn delete_movements_by_asset(&self, asset_id: &Uuid) -> Result<(), AppError>;

    /// Atomically saves the asset + its movements + its journal entries +
    /// the affected account balance changes in ONE transaction (Sec 9).
    #[allow(clippy::too_many_arguments)]
    async fn save_asset_with_accounting(
        &self,
        asset: &FixedAsset,
        movements: &[AssetMovement],
        entries: &[JournalEntry],
        accounts: &[Account],
    ) -> Result<(), AppError>;

    /// Atomically deletes the asset + its movements + the given journal
    /// entries in ONE transaction. Only drafts may be deleted (Sec 9).
    async fn delete_asset_with_accounting(
        &self,
        id: &FixedAssetId,
        entries: &[domain::shared::ids::JournalEntryId],
    ) -> Result<(), AppError>;

    async fn get_next_asset_number(&self) -> Result<i32, AppError>;
}
