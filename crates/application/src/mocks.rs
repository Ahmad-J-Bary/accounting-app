use std::sync::Mutex;
use async_trait::async_trait;
use crate::ports::account_repository::AccountRepository;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::account::Account;
use domain::assets::{FixedAsset, FixedAssetId, AssetCategory, AssetMovement, DepreciationSchedule, AssetType};
use domain::accounting::{JournalEntry, JournalEntryId};
use domain::shared::AccountId;
use crate::errors::AppError;
use uuid::Uuid;

pub struct MockAssetRepository {
    pub assets: Mutex<Vec<FixedAsset>>,
    pub movements: Mutex<Vec<AssetMovement>>,
    pub categories: Mutex<Vec<AssetCategory>>,
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
    async fn find_by_id(&self, _id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError> { Ok(None) }
    async fn find_by_number(&self, _number: &str) -> Result<Option<JournalEntry>, AppError> { Ok(None) }
    async fn list_all(&self) -> Result<Vec<JournalEntry>, AppError> { Ok(self.entries.lock().unwrap().clone()) }
    async fn list_by_account(&self, _account_id: &domain::shared::AccountId) -> Result<Vec<JournalEntry>, AppError> { Ok(vec![]) }
    async fn list_by_accounts(&self, _account_ids: &[domain::shared::AccountId]) -> Result<Vec<JournalEntry>, AppError> { Ok(vec![]) }
    async fn list_with_filters(
        &self,
        _from_date: Option<chrono::DateTime<chrono::Utc>>,
        _to_date: Option<chrono::DateTime<chrono::Utc>>,
        _journal_type: Option<domain::accounting::JournalType>,
        _account_id: Option<domain::shared::AccountId>,
        _partner_id: Option<uuid::Uuid>,
        _status: Option<domain::accounting::JournalEntryStatus>,
    ) -> Result<Vec<JournalEntry>, AppError> {
        Ok(self.entries.lock().unwrap().clone())
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
