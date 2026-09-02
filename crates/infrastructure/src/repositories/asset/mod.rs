use application::errors::AppError;
use application::ports::asset_repository::AssetRepository;
use async_trait::async_trait;
use domain::assets::{
    AssetCategory, AssetMovement, AssetType, DepreciationSchedule, FixedAsset, FixedAssetId,
};
use sqlx::SqlitePool;
use std::sync::Arc;
use uuid::Uuid;

mod commands;
mod mappers;
mod models;
mod queries;

pub struct SqliteAssetRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteAssetRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AssetRepository for SqliteAssetRepository {
    async fn save_asset(&self, asset: &FixedAsset) -> Result<(), AppError> {
        commands::save_asset(&self.pool, asset).await
    }

    async fn find_asset_by_id(&self, id: &FixedAssetId) -> Result<Option<FixedAsset>, AppError> {
        queries::find_asset_by_id(&self.pool, id).await
    }

    async fn list_assets(&self) -> Result<Vec<FixedAsset>, AppError> {
        queries::list_assets(&self.pool).await
    }

    async fn save_category(&self, category: &AssetCategory) -> Result<(), AppError> {
        commands::save_category(&self.pool, category).await
    }

    async fn list_categories(&self, asset_type: AssetType) -> Result<Vec<AssetCategory>, AppError> {
        queries::list_categories(&self.pool, asset_type).await
    }

    async fn save_movement(&self, movement: &AssetMovement) -> Result<(), AppError> {
        commands::save_movement(&self.pool, movement).await
    }

    async fn list_movements_by_asset(
        &self,
        asset_id: &Uuid,
    ) -> Result<Vec<AssetMovement>, AppError> {
        queries::list_movements_by_asset(&self.pool, asset_id).await
    }

    async fn list_all_movements(&self) -> Result<Vec<AssetMovement>, AppError> {
        queries::list_all_movements(&self.pool).await
    }

    async fn save_depreciation_schedule(
        &self,
        schedule: &DepreciationSchedule,
    ) -> Result<(), AppError> {
        commands::save_depreciation_schedule(&self.pool, schedule).await
    }

    async fn get_depreciation_schedule(
        &self,
        asset_id: &Uuid,
    ) -> Result<Vec<DepreciationSchedule>, AppError> {
        queries::get_depreciation_schedule(&self.pool, asset_id).await
    }

    async fn delete_asset(&self, id: &FixedAssetId) -> Result<(), AppError> {
        queries::delete_asset(&self.pool, id).await
    }

    async fn delete_movements_by_asset(&self, asset_id: &Uuid) -> Result<(), AppError> {
        queries::delete_movements_by_asset(&self.pool, asset_id).await
    }

    async fn save_asset_with_accounting(
        &self,
        asset: &FixedAsset,
        movements: &[AssetMovement],
        entries: &[domain::accounting::journal_entry::JournalEntry],
        accounts: &[domain::accounting::account::Account],
    ) -> Result<(), AppError> {
        commands::save_asset_with_accounting(&self.pool, asset, movements, entries, accounts).await
    }

    async fn delete_asset_with_accounting(
        &self,
        id: &FixedAssetId,
        entries: &[domain::shared::ids::JournalEntryId],
    ) -> Result<(), AppError> {
        commands::delete_asset_with_accounting(&self.pool, id, entries).await
    }

    async fn get_next_asset_number(&self) -> Result<i32, AppError> {
        queries::get_next_asset_number(&self.pool).await
    }
}
