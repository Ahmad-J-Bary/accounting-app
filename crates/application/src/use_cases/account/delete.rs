use std::sync::Arc;
use chrono::Utc;
use domain::accounting::account::{Account};
use domain::shared::ids::AccountId;
use domain::accounting::journal_entry::JournalEntryStatus;

use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;

use super::error::AccountUseCaseError;

pub struct DeleteAccountUseCase {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    customer_repo: Option<Arc<dyn CustomerRepository>>,
    supplier_repo: Option<Arc<dyn SupplierRepository>>,
}

impl DeleteAccountUseCase {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        customer_repo: Option<Arc<dyn CustomerRepository>>,
        supplier_repo: Option<Arc<dyn SupplierRepository>>,
    ) -> Self {
        Self {
            account_repo,
            journal_repo,
            customer_repo,
            supplier_repo,
        }
    }

    pub async fn delete(&self, id: AccountId) -> Result<(), AccountUseCaseError> {
        let mut account = self
            .account_repo
            .find_by_id(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        let all_accounts = self
            .account_repo
            .list_all()
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        let has_children = all_accounts
            .iter()
            .any(|a| a.parent_id.as_ref() == Some(&id));
        
        let usage = self.count_journal_usage(&id).await?;
        let is_root = account.parent_id.is_none();

        if is_root || has_children || usage > 0 {
            account.is_active = false;
            account.updated_at = Utc::now();
            self.account_repo
                .save(&account)
                .await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
            return Ok(());
        }

        // Cascade: delete linked customer if any
        if let Some(customer_id) = &account.linked_customer_id {
            if let Some(ref customer_repo) = self.customer_repo {
                let _ = customer_repo.delete(customer_id).await;
            }
        }

        // Cascade: delete linked supplier if any
        if let Some(supplier_id) = &account.linked_supplier_id {
            if let Some(ref supplier_repo) = self.supplier_repo {
                let _ = supplier_repo.delete(supplier_id).await;
            }
        }

        self.account_repo
            .delete(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(())
    }

    pub async fn set_active(
        &self,
        id: AccountId,
        active: bool,
    ) -> Result<Account, AccountUseCaseError> {
        let mut account = self
            .account_repo
            .find_by_id(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        if !active {
            self.ensure_can_deactivate(&id, &account).await?;
            account.is_active = false;
        } else {
            self.ensure_can_activate(&account).await?;
            account.is_active = true;
        }

        account.updated_at = Utc::now();

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(account)
    }

    async fn ensure_can_deactivate(
        &self,
        id: &AccountId,
        account: &Account,
    ) -> Result<(), AccountUseCaseError> {
        if account.parent_id.is_none() && matches!(account.code.as_str(), "1" | "2" | "3" | "4") {
            return Err(AccountUseCaseError::Forbidden("لا يمكن تعطيل الحسابات الجذرية الأساسية".into()));
        }

        let entries = self
            .journal_repo
            .list_by_account(id)
            .await
            .map_err(|e| AccountUseCaseError::JournalRepositoryError(e.to_string()))?;

        let has_open_posting = entries
            .iter()
            .any(|e| e.status == JournalEntryStatus::Draft);

        if has_open_posting {
            return Err(AccountUseCaseError::Forbidden("لا يمكن تعطيل حساب مستخدم في قيد مسودة/مفتوح".into()));
        }

        Ok(())
    }

    async fn ensure_can_activate(&self, account: &Account) -> Result<(), AccountUseCaseError> {
        if let Some(parent_id) = &account.parent_id {
            let parent = self
                .account_repo
                .find_by_id(parent_id)
                .await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                .ok_or(AccountUseCaseError::ParentNotFound)?;

            if !parent.is_active {
                return Err(AccountUseCaseError::Forbidden("لا يمكن تفعيل الحساب لأن الحساب الأب معطل".into()));
            }
        }
        Ok(())
    }

    async fn count_journal_usage(&self, id: &AccountId) -> Result<usize, AccountUseCaseError> {
        let entries = self
            .journal_repo
            .list_by_account(id)
            .await
            .map_err(|e| AccountUseCaseError::JournalRepositoryError(e.to_string()))?;
        Ok(entries.len())
    }
}
