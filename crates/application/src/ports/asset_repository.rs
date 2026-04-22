use async_trait::async_trait;
use domain::assets::{FixedAsset, FixedAssetId, AssetCategory, AssetMovement, DepreciationSchedule};
use domain::shared::AccountId;
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
    
    async fn save_depreciation_schedule(&self, schedule: &DepreciationSchedule) -> Result<(), AppError>;
    async fn get_depreciation_schedule(&self, asset_id: &Uuid) -> Result<Vec<DepreciationSchedule>, AppError>;
}
