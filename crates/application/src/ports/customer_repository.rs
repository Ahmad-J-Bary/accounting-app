use async_trait::async_trait;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::shared::ids::{CustomerId, AccountId, JournalEntryId};
use crate::errors::AppError;
use domain::customers::Customer;

#[async_trait]
pub trait CustomerRepository: Send + Sync {
    async fn save(&self, customer: &Customer) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &CustomerId) -> Result<Option<Customer>, AppError>;
    async fn find_by_account_id(&self, account_id: &AccountId) -> Result<Option<Customer>, AppError>;
    async fn list_all(&self) -> Result<Vec<Customer>, AppError>;
    async fn update(&self, customer: &Customer) -> Result<(), AppError>;
    async fn delete(&self, id: &CustomerId) -> Result<(), AppError>;
    async fn get_next_customer_number(&self) -> Result<i32, AppError>;

    /// Atomically persists a new customer together with its linked ledger
    /// account and any opening-balance journals in ONE transaction. Either the
    /// whole accounting event commits or none of it does (Sec 9 atomicity).
    async fn save_with_accounting(
        &self,
        customer: &Customer,
        account: &Account,
        entries: &[JournalEntry],
    ) -> Result<(), AppError>;

    /// Atomically persists a customer update together with its linked-account
    /// sync and any balance-adjustment journal in ONE transaction. `account` is
    /// `None` for partners without a linked ledger account (cash customer).
    async fn update_with_accounting(
        &self,
        customer: &Customer,
        account: Option<&Account>,
        entries: &[JournalEntry],
    ) -> Result<(), AppError>;

    /// Atomically deletes a customer, its linked account and the still-deletable
    /// journal entries referencing it in ONE transaction.
    async fn delete_with_accounting(
        &self,
        id: &CustomerId,
        account_id: Option<&AccountId>,
        entry_ids: &[JournalEntryId],
    ) -> Result<(), AppError>;
}
