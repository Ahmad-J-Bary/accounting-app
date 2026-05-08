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

pub struct CreateAssetRequest {
    pub code: String,
    pub name: String,
    pub category_id: Uuid,
    pub purchase_date: chrono::DateTime<Utc>,
    pub purchase_cost: Money,
    pub fx_rate: Decimal,
    pub useful_life_months: u32,
    pub asset_account_id: Uuid,
    pub depreciation_account_id: Uuid,
    pub accumulated_depreciation_account_id: Uuid,
    pub payment_account_id: Uuid,
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
        req: CreateAssetRequest,
    ) -> Result<FixedAssetId, AppError> {
        let asset = FixedAsset::new(
            req.code,
            req.name,
            req.category_id,
            req.purchase_date,
            req.purchase_cost.clone(),
            req.fx_rate,
            req.useful_life_months,
            req.asset_account_id,
            req.depreciation_account_id,
            req.accumulated_depreciation_account_id,
        );

        self.repo.save_asset(&asset).await?;

        let movement = AssetMovement::new(
            asset.id.0,
            AssetMovementType::Acquisition,
            req.purchase_date,
            req.purchase_cost.clone(),
            format!("شراء أصل ثابت: {}", asset.name),
        );
        self.repo.save_movement(&movement).await?;

        let mut lines = Vec::new();
        lines.push(JournalLine::new(
            AccountId(req.asset_account_id),
            MonetaryAmount::new(req.purchase_cost.clone(), req.fx_rate),
            MonetaryAmount::zero(req.purchase_cost.currency().clone()),
            format!("اثبات شراء أصل: {}", asset.name),
        ));

        lines.push(JournalLine::new(
            AccountId(req.payment_account_id),
            MonetaryAmount::zero(req.purchase_cost.currency().clone()),
            MonetaryAmount::new(req.purchase_cost.clone(), req.fx_rate),
            format!("سداد قيمة أصل: {}", asset.name),
        ));

        let entry = JournalEntry::new(
            format!("FA-ACQ-{}", asset.code),
            lines,
            req.purchase_date,
            format!("شراء أصل ثابت: {}", asset.name),
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
                "إهلاك شهري للأصل: {} - للفترة {}",
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
                "إهلاك أصل ثابت: {} للفترة {}",
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
    use std::sync::Mutex;

    impl MockAssetRepository {
        pub fn new() -> Self {
            Self::default()
        }
    }

    impl Default for MockAssetRepository {
        fn default() -> Self {
            Self {
                assets: Mutex::new(Vec::new()),
                movements: Mutex::new(Vec::new()),
                categories: Mutex::new(Vec::new()),
            }
        }
    }

    impl MockJournalRepository {
        pub fn new() -> Self {
            Self::default()
        }
    }

    impl Default for MockJournalRepository {
        fn default() -> Self {
            Self {
                entries: Mutex::new(Vec::new()),
            }
        }
    }

    #[tokio::test]
    async fn test_asset_lifecycle() {
        println!("Starting test_asset_lifecycle");
        let asset_repo = Arc::new(MockAssetRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::new());
        let use_cases = FixedAssetUseCases::new(asset_repo.clone(), journal_repo.clone());

        let purchase_date = Utc::now();
        let cost = Money::new(dec!(12000), Currency::syp());

        println!("1. Creating asset...");
        let asset_id = use_cases
            .create_asset(CreateAssetRequest {
                code: "FA-001".to_string(),
                name: "Laptop".to_string(),
                category_id: Uuid::new_v4(),
                purchase_date,
                purchase_cost: cost.clone(),
                fx_rate: dec!(1),
                useful_life_months: 12,
                asset_account_id: Uuid::new_v4(),
                depreciation_account_id: Uuid::new_v4(),
                accumulated_depreciation_account_id: Uuid::new_v4(),
                payment_account_id: Uuid::new_v4(),
            })
            .await
            .unwrap();
        println!("Asset created: {:?}", asset_id);

        // Check if saved
        let assets = use_cases.list_assets().await.unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].name, "Laptop");

        // Check Journal Entry
        {
            let entries = journal_repo.entries.lock().unwrap();
            assert_eq!(entries.len(), 1);
            assert!(entries[0].description.contains("Laptop"));
        }

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
