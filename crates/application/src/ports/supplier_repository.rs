use async_trait::async_trait;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::suppliers::Supplier;
use domain::shared::ids::{SupplierId, AccountId, JournalEntryId};
use crate::errors::AppError;

#[async_trait]
pub trait SupplierRepository: Send + Sync {
    async fn save(&self, supplier: &Supplier) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &SupplierId) -> Result<Option<Supplier>, AppError>;
    async fn find_by_account_id(&self, account_id: &AccountId) -> Result<Option<Supplier>, AppError>;
    async fn find_by_name(&self, name: &str) -> Result<Vec<Supplier>, AppError>;
    async fn list_all(&self) -> Result<Vec<Supplier>, AppError>;
    async fn update(&self, supplier: &Supplier) -> Result<(), AppError>;
    async fn delete(&self, id: &SupplierId) -> Result<(), AppError>;
    async fn get_next_supplier_number(&self) -> Result<i32, AppError>;

    /// Atomically persists a new supplier together with its linked ledger
    /// account and any opening-balance journals in ONE transaction. Either the
    /// whole accounting event commits or none of it does (Sec 9 atomicity).
    async fn save_with_accounting(
        &self,
        supplier: &Supplier,
        account: &Account,
        entries: &[JournalEntry],
    ) -> Result<(), AppError>;

    /// Atomically persists a supplier update together with its linked-account
    /// sync and any balance-adjustment journal in ONE transaction. `account` is
    /// `None` for partners without a linked ledger account (cash supplier).
    async fn update_with_accounting(
        &self,
        supplier: &Supplier,
        account: Option<&Account>,
        entries: &[JournalEntry],
    ) -> Result<(), AppError>;

    /// Atomically deletes a supplier, its linked account and the still-deletable
    /// journal entries referencing it in ONE transaction.
    async fn delete_with_accounting(
        &self,
        id: &SupplierId,
        account_id: Option<&AccountId>,
        entry_ids: &[JournalEntryId],
    ) -> Result<(), AppError>;
}
