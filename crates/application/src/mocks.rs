use std::sync::Mutex;
use async_trait::async_trait;
use crate::ports::account_repository::AccountRepository;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::settings_repository::SettingsRepository;
use domain::accounting::account::Account;
use domain::accounting::fiscal_period::FiscalPeriod;
use domain::accounting::opening_balance::OpeningBalanceMigration;
use domain::assets::{FixedAsset, FixedAssetId, AssetCategory, AssetMovement, DepreciationSchedule, AssetType};
use domain::accounting::{JournalEntry, JournalEntryId};
use domain::settings::CompanySettings;
use domain::shared::ids::FiscalPeriodId;
use domain::shared::AccountId;
use crate::errors::AppError;
use uuid::Uuid;

pub struct MockAssetRepository {
    pub assets: Mutex<Vec<FixedAsset>>,
    pub movements: Mutex<Vec<AssetMovement>>,
    pub categories: Mutex<Vec<AssetCategory>>,
    pub entries: Mutex<Vec<JournalEntry>>,
}

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
            entries: Mutex::new(Vec::new()),
        }
    }
}

#[async_trait]
impl AssetRepository for MockAssetRepository {
    async fn save_asset(&self, asset: &FixedAsset) -> Result<(), AppError> {
        let mut assets = self.assets.lock().unwrap();
        assets.retain(|a| a.id.0 != asset.id.0);
        assets.push(asset.clone());
        Ok(())
    }
    async fn find_asset_by_id(&self, id: &FixedAssetId) -> Result<Option<FixedAsset>, AppError> {
        let assets = self.assets.lock().unwrap();
        Ok(assets.iter().find(|a| a.id.0 == id.0).cloned())
    }
    async fn list_assets(&self) -> Result<Vec<FixedAsset>, AppError> {
        Ok(self.assets.lock().unwrap().clone())
    }
    async fn save_category(&self, category: &AssetCategory) -> Result<(), AppError> {
        self.categories.lock().unwrap().push(category.clone());
        Ok(())
    }
    async fn list_categories(&self, _asset_type: AssetType) -> Result<Vec<AssetCategory>, AppError> {
        Ok(self.categories.lock().unwrap().clone())
    }
    async fn save_movement(&self, movement: &AssetMovement) -> Result<(), AppError> {
        self.movements.lock().unwrap().push(movement.clone());
        Ok(())
    }
    async fn list_movements_by_asset(&self, asset_id: &Uuid) -> Result<Vec<AssetMovement>, AppError> {
        let movements = self.movements.lock().unwrap();
        Ok(movements.iter().filter(|m| m.asset_id == *asset_id).cloned().collect())
    }
    async fn list_all_movements(&self) -> Result<Vec<AssetMovement>, AppError> {
        Ok(self.movements.lock().unwrap().clone())
    }
    async fn save_depreciation_schedule(&self, _schedule: &DepreciationSchedule) -> Result<(), AppError> { Ok(()) }
    async fn get_depreciation_schedule(&self, _asset_id: &Uuid) -> Result<Vec<DepreciationSchedule>, AppError> { Ok(vec![]) }

    async fn delete_asset(&self, id: &FixedAssetId) -> Result<(), AppError> {
        let mut assets = self.assets.lock().unwrap();
        assets.retain(|a| a.id.0 != id.0);
        Ok(())
    }

    async fn delete_movements_by_asset(&self, asset_id: &Uuid) -> Result<(), AppError> {
        let mut movements = self.movements.lock().unwrap();
        movements.retain(|m| m.asset_id != *asset_id);
        Ok(())
    }

    async fn save_asset_with_accounting(
        &self,
        asset: &FixedAsset,
        movements: &[AssetMovement],
        entries: &[JournalEntry],
        _accounts: &[Account],
    ) -> Result<(), AppError> {
        self.save_asset(asset).await?;
        let mut store = self.movements.lock().unwrap();
        for m in movements {
            store.push(m.clone());
        }
        let mut entry_store = self.entries.lock().unwrap();
        for e in entries {
            entry_store.push(e.clone());
        }
        Ok(())
    }

    async fn delete_asset_with_accounting(
        &self,
        id: &FixedAssetId,
        _entries: &[JournalEntryId],
    ) -> Result<(), AppError> {
        self.delete_asset(id).await?;
        self.delete_movements_by_asset(&id.0).await
    }
}

pub struct MockJournalRepository {
    pub entries: Mutex<Vec<JournalEntry>>,
}

impl MockJournalRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for MockJournalRepository {
    fn default() -> Self {
        Self { entries: Mutex::new(Vec::new()) }
    }
}

#[async_trait]
impl JournalEntryRepository for MockJournalRepository {
    async fn save(&self, entry: &JournalEntry) -> Result<(), AppError> {
        self.entries.lock().unwrap().push(entry.clone());
        Ok(())
    }
    async fn save_reversal_pair(
        &self,
        reversal: &JournalEntry,
        original: &JournalEntry,
    ) -> Result<(), AppError> {
        let mut store = self.entries.lock().unwrap();
        store.push(reversal.clone());
        store.push(original.clone());
        Ok(())
    }
    async fn find_by_id(&self, _id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError> { Ok(None) }
    async fn find_by_number(&self, _number: &str) -> Result<Option<JournalEntry>, AppError> { Ok(None) }
    async fn list_all(&self) -> Result<Vec<JournalEntry>, AppError> { Ok(self.entries.lock().unwrap().clone()) }
    async fn list_by_account(&self, _account_id: &domain::shared::AccountId) -> Result<Vec<JournalEntry>, AppError> { Ok(vec![]) }
    async fn list_by_accounts(&self, _account_ids: &[domain::shared::AccountId]) -> Result<Vec<JournalEntry>, AppError> { Ok(vec![]) }
    async fn list_with_filters(
        &self,
        from_date: Option<chrono::DateTime<chrono::Utc>>,
        to_date: Option<chrono::DateTime<chrono::Utc>>,
        journal_type: Option<domain::accounting::JournalType>,
        account_id: Option<domain::shared::AccountId>,
        partner_id: Option<uuid::Uuid>,
        status: Option<domain::accounting::JournalEntryStatus>,
    ) -> Result<Vec<JournalEntry>, AppError> {
        let entries = self.entries.lock().unwrap();
        Ok(entries
            .iter()
            .filter(|e| {
                if let Some(from) = from_date {
                    if e.entry_date < from {
                        return false;
                    }
                }
                if let Some(to) = to_date {
                    if e.entry_date > to {
                        return false;
                    }
                }
                if let Some(jt) = journal_type.as_ref() {
                    if &e.journal_type != jt {
                        return false;
                    }
                }
                if let Some(acc) = account_id.as_ref() {
                    if !e.lines.iter().any(|l| &l.account_id == acc) {
                        return false;
                    }
                }
                if let Some(pid) = partner_id {
                    if !e.lines.iter().any(|l| l.partner_id == Some(pid)) {
                        return false;
                    }
                }
                if let Some(s) = status.as_ref() {
                    if &e.status != s {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect())
    }
    async fn get_next_entry_number(&self) -> Result<String, AppError> {
        let entries = self.entries.lock().unwrap();
        let next = entries.len() + 1;
        Ok(next.to_string())
    }
    async fn find_by_source_id(&self, source_id: &str) -> Result<Option<JournalEntry>, AppError> {
        let entries = self.entries.lock().unwrap();
        Ok(entries.iter().find(|e| e.source_id.as_deref() == Some(source_id)).cloned())
    }
    async fn find_all_by_source_id(&self, source_id: &str) -> Result<Vec<JournalEntry>, AppError> {
        let entries = self.entries.lock().unwrap();
        Ok(entries.iter().filter(|e| e.source_id.as_deref() == Some(source_id)).cloned().collect())
    }
    async fn delete(&self, _id: &JournalEntryId) -> Result<(), AppError> { Ok(()) }
}

pub struct MockAccountRepository {
    pub accounts: Mutex<Vec<Account>>,
}

impl MockAccountRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for MockAccountRepository {
    fn default() -> Self {
        Self { accounts: Mutex::new(Vec::new()) }
    }
}

#[async_trait]
impl AccountRepository for MockAccountRepository {
    async fn save(&self, account: &Account) -> Result<(), AppError> {
        let mut accounts = self.accounts.lock().unwrap();
        accounts.retain(|a| a.id.0 != account.id.0);
        accounts.push(account.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: &AccountId) -> Result<Option<Account>, AppError> {
        let accounts = self.accounts.lock().unwrap();
        Ok(accounts.iter().find(|a| a.id.0 == id.0).cloned())
    }

    async fn find_by_code(&self, _code: &str) -> Result<Option<Account>, AppError> {
        Ok(None)
    }

    async fn list_all(&self) -> Result<Vec<Account>, AppError> {
        Ok(self.accounts.lock().unwrap().clone())
    }

    async fn delete(&self, id: &AccountId) -> Result<(), AppError> {
        let mut accounts = self.accounts.lock().unwrap();
        accounts.retain(|a| a.id.0 != id.0);
        Ok(())
    }

    async fn get_next_child_code(&self, _parent_code: &str) -> Result<String, AppError> {
        Ok("001".to_string())
    }
}

pub struct MockFiscalPeriodRepository {
    pub periods: Mutex<Vec<FiscalPeriod>>,
}impl MockFiscalPeriodRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for MockFiscalPeriodRepository {
    fn default() -> Self {
        Self { periods: Mutex::new(Vec::new()) }
    }
}

#[async_trait]
impl FiscalPeriodRepository for MockFiscalPeriodRepository {
    async fn create(&self, period: &FiscalPeriod) -> Result<(), AppError> {
        self.periods.lock().unwrap().push(period.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: &FiscalPeriodId) -> Result<Option<FiscalPeriod>, AppError> {
        Ok(self.periods.lock().unwrap().iter().find(|p| p.id == *id).cloned())
    }

    async fn list(&self) -> Result<Vec<FiscalPeriod>, AppError> {
        Ok(self.periods.lock().unwrap().clone())
    }

    async fn find_by_date(&self, date: chrono::DateTime<chrono::Utc>) -> Result<Vec<FiscalPeriod>, AppError> {
        Ok(self
            .periods
            .lock()
            .unwrap()
            .iter()
            .filter(|p| p.contains(date))
            .cloned()
            .collect())
    }

    async fn update(&self, period: &FiscalPeriod) -> Result<(), AppError> {
        let mut periods = self.periods.lock().unwrap();
        periods.retain(|p| p.id != period.id);
        periods.push(period.clone());
        Ok(())
    }
}

pub struct MockSettingsRepository {
    pub settings: Mutex<CompanySettings>,
}

impl MockSettingsRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for MockSettingsRepository {
    fn default() -> Self {
        Self { settings: Mutex::new(CompanySettings::default()) }
    }
}

#[async_trait]
impl SettingsRepository for MockSettingsRepository {
    async fn get(&self) -> Result<CompanySettings, AppError> {
        Ok(self.settings.lock().unwrap().clone())
    }

    async fn save(&self, settings: &CompanySettings) -> Result<(), AppError> {
        let mut store = self.settings.lock().unwrap();
        *store = settings.clone();
        Ok(())
    }
}

pub struct MockOpeningMigrationRepository {
    pub migrations: Mutex<Vec<OpeningBalanceMigration>>,
}

impl MockOpeningMigrationRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for MockOpeningMigrationRepository {
    fn default() -> Self {
        Self { migrations: Mutex::new(Vec::new()) }
    }
}

#[async_trait]
impl OpeningMigrationRepository for MockOpeningMigrationRepository {
    async fn create(&self, m: &OpeningBalanceMigration) -> Result<(), AppError> {
        self.migrations.lock().unwrap().push(m.clone());
        Ok(())
    }
    async fn update(&self, _m: &OpeningBalanceMigration) -> Result<(), AppError> {
        Ok(())
    }
    async fn find_by_id(&self, id: &str) -> Result<Option<OpeningBalanceMigration>, AppError> {
        Ok(self.migrations.lock().unwrap().iter().find(|m| m.id == id).cloned())
    }
    async fn find_by_cutover_date(&self, _cutover_date: &str) -> Result<Vec<OpeningBalanceMigration>, AppError> {
        Ok(self.migrations.lock().unwrap().clone())
    }
    async fn list(&self) -> Result<Vec<OpeningBalanceMigration>, AppError> {
        Ok(self.migrations.lock().unwrap().clone())
    }
    async fn delete(&self, _id: &str) -> Result<(), AppError> {
        Ok(())
    }
}
