use crate::errors::AppError;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use chrono::Utc;
use domain::accounting::{JournalEntry, JournalLine};
use domain::assets::{
    AssetCategory, AssetMovement, AssetMovementType, AssetType, FixedAsset, FixedAssetId,
};
use domain::shared::{AccountId, MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

pub struct FixedAssetUseCases {
    repo: Arc<dyn AssetRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl FixedAssetUseCases {
    pub fn new(
        repo: Arc<dyn AssetRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
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
            MonetaryAmount::new(purchase_cost.clone(), fx_rate),
            MonetaryAmount::zero(purchase_cost.currency().clone()),
            format!("اثبات شراء أصل: {}", asset.name),
        ));

        lines.push(JournalLine::new(
            AccountId(payment_account_id),
            MonetaryAmount::zero(purchase_cost.currency().clone()),
            MonetaryAmount::new(purchase_cost.clone(), fx_rate),
            format!("سداد قيمة أصل: {}", asset.name),
        ));

        let entry = JournalEntry::new(
            format!("FA-ACQ-{}", asset.code),
            lines,
            purchase_date,
            format!("Ø´Ø±Ø§Ø¡ Ø£ØµÙ„ Ø«Ø§Ø¨Øª: {}", asset.name),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_repo.save(&entry).await?;

        Ok(asset.id)
    }

    pub async fn list_assets(&self) -> Result<Vec<FixedAsset>, AppError> {
        self.repo.list_assets().await
    }

    pub async fn create_category(
        &self,
        name: String,
        asset_type: AssetType,
    ) -> Result<Uuid, AppError> {
        let category = AssetCategory::new(name, asset_type);
        self.repo.save_category(&category).await?;
        Ok(category.id)
    }

    pub async fn list_categories(
        &self,
        asset_type: AssetType,
    ) -> Result<Vec<AssetCategory>, AppError> {
        self.repo.list_categories(asset_type).await
    }

    pub async fn post_depreciation(
        &self,
        asset_id: Uuid,
        date: chrono::DateTime<Utc>,
    ) -> Result<(), AppError> {
        let mut asset = self
            .repo
            .find_asset_by_id(&FixedAssetId(asset_id))
            .await?
            .ok_or_else(|| AppError::NotFound("Asset not found".to_string()))?;

        let depreciation_money = asset.depreciate();
        self.repo.save_asset(&asset).await?;

        let movement = AssetMovement::new(
            asset.id.0,
            AssetMovementType::Depreciation,
            date,
            depreciation_money.clone(),
            format!(
                "Ø¥Ù‡Ù„Ø§Ùƒ Ø´Ù‡Ø±ÙŠ Ù„Ù„Ø£ØµÙ„: {} - Ù„Ù„ÙØªØ±Ø© {}",
                asset.name,
                date.format("%Y-%m")
            ),
        );
        self.repo.save_movement(&movement).await?;

        let mut lines = Vec::new();
        lines.push(JournalLine::new(
            AccountId(asset.depreciation_account_id),
            MonetaryAmount::new(depreciation_money.clone(), asset.fx_rate),
            MonetaryAmount::zero(asset.purchase_cost.currency().clone()),
            format!("مصروف إهلاك: {}", asset.name),
        ));
        lines.push(JournalLine::new(
            AccountId(asset.accumulated_depreciation_account_id),
            MonetaryAmount::zero(asset.purchase_cost.currency().clone()),
            MonetaryAmount::new(depreciation_money.clone(), asset.fx_rate),
            format!("مجمع إهلاك: {}", asset.name),
        ));

        let entry = JournalEntry::new(
            format!("FA-DEP-{}-{}", asset.code, date.format("%Y%m")),
            lines,
            date,
            format!(
                "Ø¥Ù‡Ù„Ø§Ùƒ Ø£ØµÙ„ Ø«Ø§Ø¨Øª: {} Ù„Ù„ÙØªØ±Ø© {}",
                asset.name,
                date.format("%Y-%m")
            ),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_repo.save(&entry).await?;

        Ok(())
    }

    pub async fn list_movements(&self, asset_id: Uuid) -> Result<Vec<AssetMovement>, AppError> {
        self.repo.list_movements_by_asset(&asset_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockAssetRepository, MockJournalRepository};
    use domain::shared::Currency;
    use rust_decimal_macros::dec;

    #[tokio::test]
    async fn test_asset_lifecycle() {
        println!("Starting test_asset_lifecycle");
        let asset_repo = Arc::new(MockAssetRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::new());
        let use_cases = FixedAssetUseCases::new(asset_repo.clone(), journal_repo.clone());

        let purchase_date = Utc::now();
        let cost = Money::new(dec!(12000), Currency::syp());

        println!("1. Creating asset...");
        // 1. Create Asset
        let asset_id = use_cases
            .create_asset(
                "FA-001".to_string(),
                "Laptop".to_string(),
                Uuid::new_v4(),
                purchase_date,
                cost.clone(),
                dec!(1),
                12,
                Uuid::new_v4(),
                Uuid::new_v4(),
                Uuid::new_v4(),
                Uuid::new_v4(),
            )
            .await
            .unwrap();
        println!("Asset created: {:?}", asset_id);

        // Check if saved
        let assets = use_cases.list_assets().await.unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].name, "Laptop");

        // Check Journal Entry
        let entries = journal_repo.entries.lock().unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].description.contains("Laptop"));
        drop(entries); // Explicitly drop to be safe

        println!("2. Posting depreciation...");
        // 2. Post Depreciation
        use_cases
            .post_depreciation(asset_id.0, Utc::now())
            .await
            .unwrap();
        println!("Depreciation posted.");

        // Check updated asset
        let updated_asset = asset_repo
            .find_asset_by_id(&asset_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(updated_asset.accumulated_depreciation.amount(), dec!(1000));

        // Check Movements
        let movements = asset_repo.movements.lock().unwrap();
        assert_eq!(movements.len(), 2); // Acquisition + Depreciation
        assert_eq!(movements[1].amount.amount(), dec!(1000));
        println!("Test finished.");
    }
}
