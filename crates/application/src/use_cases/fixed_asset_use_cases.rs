use std::sync::Arc;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::assets::{FixedAsset, FixedAssetId, AssetMovement, AssetMovementType};
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
        );

        // 1. Save Asset
        self.repo.save_asset(&asset).await?;

        // 2. Create Movement
        let movement = AssetMovement::new(
            asset.id.0,
            AssetMovementType::Acquisition,
            purchase_date,
            purchase_cost.clone(),
            format!("شراء أصل ثابت: {}", asset.name),
        );
        self.repo.save_movement(&movement).await?;

        // 3. Create Journal Entry (Accounting Integration)
        let mut lines = Vec::new();
        
        // Debit: Fixed Assets Account
        lines.push(JournalLine::new(
            AccountId(asset_account_id),
            purchase_cost.currency(),
            fx_rate,
            purchase_cost.clone(),
            Money::new(Decimal::ZERO, purchase_cost.currency()),
            format!("إثبات شراء أصل: {}", asset.name),
        ));

        // Credit: Cash/Supplier Account
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
}
