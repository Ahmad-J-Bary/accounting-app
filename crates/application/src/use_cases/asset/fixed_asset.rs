use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::settings_repository::SettingsRepository;
use chrono::Utc;
use domain::accounting::{JournalEntry, JournalLine, MigrationStatus};
use domain::settings::START_MODE_EXISTING;
use domain::assets::{
    AssetCategory, AssetMovement, AssetMovementType, AssetType, DepreciationMethod, FixedAsset, FixedAssetId,
};
use domain::shared::{AccountId, MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use serde::{Deserialize, Serialize};

pub struct FixedAssetUseCases {
    repo: Arc<dyn AssetRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    settings_repo: Arc<dyn SettingsRepository>,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotationResult {
    pub asset_id: String,
    pub asset_name: String,
    pub depreciation_amount: f64,
    pub accumulated_depreciation: f64,
    pub net_book_value: f64,
}

pub struct CreateAssetRequest {
    pub code: String,
    pub name: String,
    pub category_id: Uuid,
    pub warehouse_id: Option<Uuid>,
    pub purchase_date: chrono::DateTime<Utc>,
    pub purchase_cost: Money,
    pub fx_rate: Decimal,
    pub useful_life_months: u32,
    pub asset_account_id: Uuid,
    pub depreciation_account_id: Uuid,
    pub accumulated_depreciation_account_id: Uuid,
    pub payment_account_id: Uuid,
    pub addition_type: String,
    pub notes: Option<String>,
    pub location: Option<String>,
    pub salvage_value: Option<Money>,
    pub depreciation_method: Option<String>,
}

impl FixedAssetUseCases {
    pub fn new(
        repo: Arc<dyn AssetRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        settings_repo: Arc<dyn SettingsRepository>,
        opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    ) -> Self {
        Self {
            repo,
            journal_repo,
            account_repo,
            settings_repo,
            opening_migration_repo,
        }
    }

    /// Whether the company is still inside its opening-preparation window: an
    /// existing company whose opening migration is not yet sealed. Mirrors the
    /// repository opening gate (`insert_entry`/`validate_opening_gate`) so the
    /// fixed-asset module and daily-log posting agree on when the migration
    /// aggregate owns the GL opening position.
    async fn opening_preparation_active(&self) -> Result<bool, AppError> {
        let settings = self.settings_repo.get().await?;
        if settings.accounting_start_mode != START_MODE_EXISTING {
            return Ok(false);
        }
        let migrations = self.opening_migration_repo.list().await?;
        let pending = migrations
            .iter()
            .filter(|m| {
                m.status != MigrationStatus::Cancelled && m.status != MigrationStatus::Locked
            })
            .count();
        Ok(pending > 0)
    }

    pub async fn create_asset(
        &self,
        req: CreateAssetRequest,
    ) -> Result<FixedAssetId, AppError> {
        let asset = FixedAsset::new(
            req.code,
            req.name,
            req.category_id,
            req.warehouse_id,
            req.purchase_date,
            req.purchase_cost.clone(),
            req.fx_rate,
            req.useful_life_months,
            req.asset_account_id,
            req.depreciation_account_id,
            req.accumulated_depreciation_account_id,
        );

        let mut asset = asset;
        if let Some(ref notes) = req.notes {
            asset.notes = Some(notes.clone());
        }
        if let Some(ref location) = req.location {
            asset.location = Some(location.clone());
        }
        if let Some(ref salvage) = req.salvage_value {
            asset.salvage_value = Some(salvage.clone());
        }
        if let Some(ref method) = req.depreciation_method {
            match method.as_str() {
                "DecliningBalance" => asset.depreciation_method = DepreciationMethod::DecliningBalance,
                _ => asset.depreciation_method = DepreciationMethod::StraightLine,
            }
        }

        let (movement_desc, entry_desc, line1_desc, line2_desc) = match req.addition_type.as_str() {
            "existing" => (
                format!("إضافة أصل سابق (أول المدة): {}", asset.name),
                format!("إضافة أصل سابق (أول المدة): {}", asset.name),
                format!("اثبات أصل سابق: {}", asset.name),
                format!("مقابل رصيد افتتاحي: {}", asset.name),
            ),
            _ => (
                format!("شراء أصل ثابت: {}", asset.name),
                format!("شراء أصل ثابت: {}", asset.name),
                format!("اثبات شراء أصل: {}", asset.name),
                format!("سداد قيمة أصل: {}", asset.name),
            ),
        };

        let movement = AssetMovement::new(
            asset.id.0,
            AssetMovementType::Acquisition,
            req.purchase_date,
            req.purchase_cost.clone(),
            movement_desc,
        );

        // Opening-preparation window (Phase 2): while the company is preparing
        // its opening migration, fixed-asset records are SUBLEDGER data only —
        // the migration aggregate posts the single GL opening journal. Writing a
        // per-asset GeneralJournal here would book the same opening balance twice
        // (subledger + migration) in Trial Balance / Balance Sheet. No journal
        // and no account-balance mutation are persisted in this window.
        if self.opening_preparation_active().await? {
            self.repo
                .save_asset_with_accounting(&asset, &[movement], &[], &[])
                .await?;
            return Ok(asset.id);
        }

        let lines = vec![
            JournalLine::new(
                AccountId(req.asset_account_id),
                MonetaryAmount::new(req.purchase_cost.clone(), req.fx_rate),
                MonetaryAmount::zero(req.purchase_cost.currency().clone()),
                line1_desc,
            ),
            JournalLine::new(
                AccountId(req.payment_account_id),
                MonetaryAmount::zero(req.purchase_cost.currency().clone()),
                MonetaryAmount::new(req.purchase_cost.clone(), req.fx_rate),
                line2_desc,
            ),
        ];

        let entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            domain::accounting::JournalType::GeneralJournal,
            lines,
            req.purchase_date,
            entry_desc,
            Some(asset.id.0.to_string()),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        // --- Update account balances (computed in memory, persisted below) ---
        let base_amount = req.purchase_cost.to_base(req.fx_rate);
        let mut accounts = Vec::new();
        if let Some(mut asset_account) = self.account_repo.find_by_id(&AccountId(req.asset_account_id)).await? {
            asset_account.debit(base_amount).map_err(|e| AppError::Invalid(e.to_string()))?;
            asset_account.debit += base_amount;
            accounts.push(asset_account);
        }
        if let Some(mut payment_account) = self.account_repo.find_by_id(&AccountId(req.payment_account_id)).await? {
            payment_account.credit(base_amount).map_err(|e| AppError::Invalid(e.to_string()))?;
            payment_account.credit += base_amount;
            accounts.push(payment_account);
        }

        // Commit asset + movement + journal + account balances in ONE
        // transaction (Sec 9 atomicity).
        self.repo.save_asset_with_accounting(&asset, &[movement], &[entry], &accounts).await?;

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
            self.journal_repo.get_next_entry_number().await?,
            domain::accounting::JournalType::GeneralJournal,
            lines,
            date,
            format!(
                "إهلاك أصل ثابت: {} للفترة {}",
                asset.name,
                date.format("%Y-%m")
            ),
            // Each month's depreciation is its own idempotent event; the
            // acquisition journal already owns `asset.id` as its source.
            Some(format!("asset:{}:depreciation:{}", asset.id.0, date.format("%Y-%m"))),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        // Commit updated asset + movement + journal in ONE transaction
        // (Sec 9 atomicity).
        self.repo.save_asset_with_accounting(&asset, &[movement], &[entry], &[]).await?;

        Ok(())
    }

    pub async fn list_movements(&self, asset_id: Uuid) -> Result<Vec<AssetMovement>, AppError> {
        self.repo.list_movements_by_asset(&asset_id).await
    }

    pub async fn update_asset(
        &self,
        id: FixedAssetId,
        req: CreateAssetRequest,
    ) -> Result<(), AppError> {
        let mut asset = self
            .repo
            .find_asset_by_id(&id)
            .await?
            .ok_or_else(|| AppError::NotFound("Asset not found".to_string()))?;

        asset.code = req.code;
        asset.name = req.name.clone();
        asset.category_id = req.category_id;
        asset.warehouse_id = req.warehouse_id;
        asset.purchase_date = req.purchase_date;
        asset.purchase_cost = req.purchase_cost.clone();
        asset.fx_rate = req.fx_rate;
        asset.useful_life_months = req.useful_life_months;
        asset.notes = req.notes.clone();
        asset.location = req.location.clone();
        asset.salvage_value = req.salvage_value.clone();
        asset.asset_account_id = req.asset_account_id;
        asset.depreciation_account_id = req.depreciation_account_id;
        asset.accumulated_depreciation_account_id = req.accumulated_depreciation_account_id;
        if let Some(ref method) = req.depreciation_method {
            match method.as_str() {
                "DecliningBalance" => asset.depreciation_method = DepreciationMethod::DecliningBalance,
                _ => asset.depreciation_method = DepreciationMethod::StraightLine,
            }
        }
        asset.updated_at = Utc::now();

        // Collect the acquisition movement and journal updates; all persisted
        // atomically below (Sec 9 atomicity).
        let mut movements = Vec::new();
        let mut entries = Vec::new();

        // Also update the acquisition movement
        let asset_movements = self.repo.list_movements_by_asset(&id.0).await?;
        if let Some(mut acq_mov) = asset_movements.into_iter().find(|m| m.movement_type == domain::assets::AssetMovementType::Acquisition) {
            acq_mov.date = req.purchase_date;
            acq_mov.amount = req.purchase_cost.clone();
            acq_mov.description = match req.addition_type.as_str() {
                "existing" => format!("إضافة أصل سابق (أول المدة): {}", req.name),
                _ => format!("شراء أصل ثابت: {}", req.name),
            };
            movements.push(acq_mov);
        }

        // Also update the acquisition journal entry if it exists.
        // Only draft entries are editable; posted ones are immutable.
        let all_entries = self.journal_repo.find_all_by_source_id(&id.0.to_string()).await?;
        crate::use_cases::journal::guards::ensure_deletable(&all_entries)?;
        if let Some(mut entry) = all_entries.into_iter().find(|e| e.journal_type != domain::accounting::JournalType::GeneralJournal || !e.description.contains("إهلاك")) {
            entry.description = match req.addition_type.as_str() {
                "existing" => format!("إضافة أصل سابق (أول المدة): {}", req.name),
                _ => format!("شراء أصل ثابت: {}", req.name),
            };
            entry.entry_date = req.purchase_date;

            let line1_desc = match req.addition_type.as_str() {
                "existing" => format!("اثبات أصل سابق: {}", req.name),
                _ => format!("اثبات شراء أصل: {}", req.name),
            };
            let line2_desc = match req.addition_type.as_str() {
                "existing" => format!("مقابل رصيد افتتاحي: {}", req.name),
                _ => format!("سداد قيمة أصل: {}", req.name),
            };

            entry.lines = vec![
                JournalLine::new(
                    AccountId(req.asset_account_id),
                    MonetaryAmount::new(req.purchase_cost.clone(), req.fx_rate),
                    MonetaryAmount::zero(req.purchase_cost.currency().clone()),
                    line1_desc,
                ),
                JournalLine::new(
                    AccountId(req.payment_account_id),
                    MonetaryAmount::zero(req.purchase_cost.currency().clone()),
                    MonetaryAmount::new(req.purchase_cost.clone(), req.fx_rate),
                    line2_desc,
                ),
            ];
            entries.push(entry);
        }

        // Commit asset + movement + journal in ONE transaction.
        self.repo.save_asset_with_accounting(&asset, &movements, &entries, &[]).await?;

        Ok(())
    }

    pub async fn delete_asset(&self, id: FixedAssetId) -> Result<(), AppError> {
        // Find all journal entries for this source. Only drafts may be deleted;
        // posted entries are immutable and must go through a reversal.
        let entries = self.journal_repo.find_all_by_source_id(&id.0.to_string()).await?;
        crate::use_cases::journal::guards::ensure_deletable(&entries)?;
        let entry_ids: Vec<_> = entries.into_iter().map(|e| e.id).collect();
        // Delete journal entries + movements + asset in ONE transaction
        // (Sec 9 atomicity).
        self.repo.delete_asset_with_accounting(&id, &entry_ids).await?;
        Ok(())
    }

    pub async fn run_yearly_rotation(
        &self,
        date: chrono::DateTime<Utc>,
    ) -> Result<Vec<RotationResult>, AppError> {
        let assets = self.repo.list_assets().await?;
        let active_assets: Vec<_> = assets
            .into_iter()
            .filter(|a| a.status == domain::assets::AssetStatus::Active)
            .collect();

        let mut results = Vec::new();

        for mut asset in active_assets {
            let depreciation_amount = asset.depreciate_yearly();

            if depreciation_amount.amount() <= Decimal::ZERO {
                continue;
            }

            let movement = AssetMovement::new(
                asset.id.0,
                AssetMovementType::Depreciation,
                date,
                depreciation_amount.clone(),
                format!(
                    "إهلاك سنوي للأصل: {} - للفترة {}",
                    asset.name,
                    date.format("%Y")
                ),
            );

            let lines = vec![
                JournalLine::new(
                    AccountId(asset.depreciation_account_id),
                    MonetaryAmount::new(depreciation_amount.clone(), asset.fx_rate),
                    MonetaryAmount::zero(asset.purchase_cost.currency().clone()),
                    format!("مصروف إهلاك: {}", asset.name),
                ),
                JournalLine::new(
                    AccountId(asset.accumulated_depreciation_account_id),
                    MonetaryAmount::zero(asset.purchase_cost.currency().clone()),
                    MonetaryAmount::new(depreciation_amount.clone(), asset.fx_rate),
                    format!("مجمع إهلاك: {}", asset.name),
                ),
            ];

            let entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                domain::accounting::JournalType::GeneralJournal,
                lines,
                date,
                format!(
                    "إهلاك سنوي: {} للفترة {}",
                    asset.name,
                    date.format("%Y")
                ),
                // Yearly depreciation is its own idempotent event per year
                // (acquisition owns `asset.id` as its source).
                Some(format!("asset:{}:depreciation:year:{}", asset.id.0, date.format("%Y"))),
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;

            // Commit updated asset + movement + journal in ONE transaction
            // (Sec 9 atomicity).
            self.repo.save_asset_with_accounting(&asset, &[movement], &[entry], &[]).await?;

            results.push(RotationResult {
                asset_id: asset.id.0.to_string(),
                asset_name: asset.name.clone(),
                depreciation_amount: depreciation_amount.amount().to_string().parse().unwrap_or(0.0),
                accumulated_depreciation: asset.accumulated_depreciation.amount().to_string().parse().unwrap_or(0.0),
                net_book_value: asset.net_book_value().amount().to_string().parse().unwrap_or(0.0),
            });
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{
        MockAccountRepository, MockAssetRepository, MockJournalRepository,
        MockOpeningMigrationRepository, MockSettingsRepository,
    };
    use domain::shared::Currency;
    use rust_decimal_macros::dec;

    fn test_currency() -> Currency {
        Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
    }

    #[tokio::test]
    async fn test_asset_lifecycle() {
        println!("Starting test_asset_lifecycle");
        let asset_repo = Arc::new(MockAssetRepository::default());
        let journal_repo = Arc::new(MockJournalRepository::default());
        let account_repo = Arc::new(MockAccountRepository::default());
        let settings_repo = Arc::new(MockSettingsRepository::default());
        let opening_migration_repo = Arc::new(MockOpeningMigrationRepository::default());
        let use_cases = FixedAssetUseCases::new(
            asset_repo.clone(),
            journal_repo.clone(),
            account_repo.clone(),
            settings_repo.clone(),
            opening_migration_repo.clone(),
        );

        let purchase_date = Utc::now();
        let cost = Money::new(dec!(12000), test_currency());

        println!("1. Creating asset...");
        let asset_id = use_cases
            .create_asset(CreateAssetRequest {
                code: "FA-001".to_string(),
                name: "Laptop".to_string(),
                category_id: Uuid::new_v4(),
                warehouse_id: None,
                purchase_date,
                purchase_cost: cost.clone(),
                fx_rate: dec!(1),
                useful_life_months: 12,
                asset_account_id: Uuid::new_v4(),
                depreciation_account_id: Uuid::new_v4(),
                accumulated_depreciation_account_id: Uuid::new_v4(),
                payment_account_id: Uuid::new_v4(),
                addition_type: "new".to_string(),
                notes: None,
                location: None,
                salvage_value: None,
                depreciation_method: None,
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
            let entries = asset_repo.entries.lock().unwrap();
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
