use std::sync::Arc;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::assets::{FixedAsset, FixedAssetId, AssetMovement, AssetMovementType, AssetCategory, AssetType};
use domain::accounting::{JournalEntry, JournalLine};
use domain::shared::{Money, AccountId};
use crate::errors::AppError;
use chrono::Utc;
use rust_decimal::Decimal;
use uuid::Uuid;

pub struct FixedAssetUseCases {
    repo: Arc<dyn AssetRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl FixedAssetUseCases {
    pub fn new(repo: Arc<dyn AssetRepository>, journal_repo: Arc<dyn JournalEntryRepository>) -> Self {
        Self { repo, journal_repo }
    }

    pub async fn create_asset(
        &self,
        code: String,
        name: String,
        category_id: Uuid,
        purchase_date: chrono::DateTime<Utc>,
        purchase_cost: Money,
        fx_rate: Decimal,
        useful_life_months: u32,
        asset_account_id: Uuid,
        depreciation_account_id: Uuid,
        accumulated_depreciation_account_id: Uuid,
        payment_account_id: Uuid,
    ) -> Result<FixedAssetId, AppError> {
        let asset = FixedAsset::new(
            code,
            name,
            category_id,
            purchase_date,
            purchase_cost.clone(),
            fx_rate,
            useful_life_months,
            asset_account_id,
            depreciation_account_id,
            accumulated_depreciation_account_id,
        );

        self.repo.save_asset(&asset).await?;

        let movement = AssetMovement::new(
            asset.id.0,
            AssetMovementType::Acquisition,
            purchase_date,
            purchase_cost.clone(),
            format!("شراء أصل ثابت: {}", asset.name),
        );
        self.repo.save_movement(&movement).await?;

        let mut lines = Vec::new();
        lines.push(JournalLine::new(
            AccountId(asset_account_id),
            purchase_cost.currency(),
            fx_rate,
            purchase_cost.clone(),
            Money::new(Decimal::ZERO, purchase_cost.currency()),
            format!("إثبات شراء أصل: {}", asset.name),
        ));

        lines.push(JournalLine::new(
            AccountId(payment_account_id),
            purchase_cost.currency(),
            fx_rate,
            Money::new(Decimal::ZERO, purchase_cost.currency()),
            purchase_cost.clone(),
            format!("سداد قيمة أصل: {}", asset.name),
        ));

        let entry = JournalEntry::new(
            format!("FA-ACQ-{}", asset.code),
            lines,
            purchase_date,
            format!("شراء أصل ثابت: {}", asset.name),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_repo.save(&entry).await?;

        Ok(asset.id)
    }

    pub async fn list_assets(&self) -> Result<Vec<FixedAsset>, AppError> {
        self.repo.list_assets().await
    }

    pub async fn create_category(&self, name: String, asset_type: AssetType) -> Result<Uuid, AppError> {
        let category = AssetCategory::new(name, asset_type);
        self.repo.save_category(&category).await?;
        Ok(category.id)
    }

    pub async fn list_categories(&self, asset_type: AssetType) -> Result<Vec<AssetCategory>, AppError> {
        self.repo.list_categories(asset_type).await
    }

    pub async fn post_depreciation(&self, asset_id: Uuid, date: chrono::DateTime<Utc>) -> Result<(), AppError> {
        let asset = self.repo.find_asset_by_id(&FixedAssetId(asset_id)).await?
            .ok_or_else(|| AppError::NotFound("Asset not found".to_string()))?;

        let monthly_depreciation = asset.purchase_cost.amount() / Decimal::from(asset.useful_life_months);
        let depreciation_money = Money::new(monthly_depreciation, asset.purchase_cost.currency());

        let mut updated_asset = asset.clone();
        updated_asset.accumulated_depreciation = asset.accumulated_depreciation.clone() + depreciation_money.clone();
        updated_asset.updated_at = Utc::now();
        self.repo.save_asset(&updated_asset).await?;

        let movement = AssetMovement::new(
            asset.id.0,
            AssetMovementType::Depreciation,
            date,
            depreciation_money.clone(),
            format!("إهلاك شهري للأصل: {} - للفترة {}", asset.name, date.format("%Y-%m")),
        );
        self.repo.save_movement(&movement).await?;

        let mut lines = Vec::new();
        lines.push(JournalLine::new(
            AccountId(asset.depreciation_account_id),
            asset.purchase_cost.currency(),
            asset.fx_rate,
            depreciation_money.clone(),
            Money::new(Decimal::ZERO, asset.purchase_cost.currency()),
            format!("مصروف إهلاك: {}", asset.name),
        ));

        lines.push(JournalLine::new(
            AccountId(asset.accumulated_depreciation_account_id),
            asset.purchase_cost.currency(),
            asset.fx_rate,
            Money::new(Decimal::ZERO, asset.purchase_cost.currency()),
            depreciation_money.clone(),
            format!("مجمع إهلاك: {}", asset.name),
        ));

        let entry = JournalEntry::new(
            format!("FA-DEP-{}-{}", asset.code, date.format("%Y%m")),
            lines,
            date,
            format!("إهلاك أصل ثابت: {} للفترة {}", asset.name, date.format("%Y-%m")),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_repo.save(&entry).await?;

        Ok(())
    }

    pub async fn list_movements(&self, asset_id: Uuid) -> Result<Vec<AssetMovement>, AppError> {
        self.repo.list_movements_by_asset(&asset_id).await
    }
}
