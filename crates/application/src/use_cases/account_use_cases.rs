use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::shared::AccountId;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use chrono::Utc;
use std::sync::Arc;
use thiserror::Error;
use serde::Deserialize;
use rust_decimal::Decimal;
use std::str::FromStr;

#[derive(Error, Debug)]
pub enum AccountUseCaseError {
    #[error("Account repository error: {0}")]
    RepositoryError(String),
    #[error("Parent account not found: {0}")]
    ParentNotFound(String),
    #[error("Code {0} already exists")]
    CodeExists(String),
    #[error("Invalid decimal value: {0}")]
    InvalidDecimal(String),
    #[error("Cannot delete account with existing journal entries")]
    HasJournalEntries,
    #[error("Cannot delete summary account with children")]
    HasChildren,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountCommand {
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub account_type: AccountType,
    pub parent_id: Option<AccountId>,
    pub category: AccountCategory,
    pub level: i32,
    pub opening_balance: String,
    pub notes: Option<String>,
    pub is_default: bool,
}

pub struct AccountUseCases {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl AccountUseCases {
    pub fn new(account_repo: Arc<dyn AccountRepository>, journal_repo: Arc<dyn JournalEntryRepository>) -> Self {
        Self { account_repo, journal_repo }
    }

    pub async fn create_account(&self, cmd: CreateAccountCommand) -> Result<Account, AccountUseCaseError> {
        let opening_balance = Decimal::from_str(&cmd.opening_balance)
            .map_err(|e| AccountUseCaseError::InvalidDecimal(e.to_string()))?;

        // Check code exists
        if let Some(_) = self.account_repo.find_by_code(&cmd.code).await.map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))? {
            return Err(AccountUseCaseError::CodeExists(cmd.code));
        }

        let account = Account {
            id: AccountId::new(),
            code: cmd.code,
            name_ar: cmd.name_ar,
            name_en: cmd.name_en,
            account_type: cmd.account_type,
            parent_id: cmd.parent_id,
            balance: opening_balance,
            is_active: true,
            is_default: cmd.is_default,
            category: cmd.category,
            level: cmd.level,
            opening_balance,
            notes: cmd.notes,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo.save(&account).await.map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(account)
    }

    pub async fn update_account(&self, id: AccountId, cmd: CreateAccountCommand) -> Result<Account, AccountUseCaseError> {
        let opening_balance = Decimal::from_str(&cmd.opening_balance)
            .map_err(|e| AccountUseCaseError::InvalidDecimal(e.to_string()))?;

        let mut account = self.account_repo.find_by_id(&id).await.map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?.ok_or_else(|| AccountUseCaseError::RepositoryError("Account not found".to_string()))?;

        account.code = cmd.code;
        account.name_ar = cmd.name_ar;
        account.name_en = cmd.name_en;
        account.account_type = cmd.account_type;
        account.parent_id = cmd.parent_id;
        account.category = cmd.category;
        account.level = cmd.level;
        account.opening_balance = opening_balance;
        account.notes = cmd.notes;
        account.is_default = cmd.is_default;
        account.updated_at = Utc::now();

        self.account_repo.save(&account).await.map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(account)
    }

    pub async fn delete_account(&self, id: AccountId) -> Result<(), AccountUseCaseError> {
        // 1. Check if it has journal entries
        let entries = self.journal_repo.list_by_account(&id).await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        
        if !entries.is_empty() {
            return Err(AccountUseCaseError::HasJournalEntries);
        }

        // 2. Check if it's a summary account with children
        let all_accounts = self.account_repo.list_all().await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        
        let target_id = id.clone();
        let has_children = all_accounts.iter().any(|a| a.parent_id == Some(target_id.clone()));
        if has_children {
            return Err(AccountUseCaseError::HasChildren);
        }

        // 3. Perform delete
        self.account_repo.delete(&id).await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        Ok(())
    }
}
