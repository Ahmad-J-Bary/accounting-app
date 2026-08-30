use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::accounting::account::Account;
use domain::shared::currency::Currency;
use domain::shared::ids::{AccountId, CustomerId, SupplierId};

use crate::ports::account_repository::AccountRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::constants::{RECEIVABLES_PARENT_ID, PAYABLES_PARENT_ID};
use crate::use_cases::opening_balance::opening_window_active;

use super::error::AccountUseCaseError;
use super::types::CreateAccountCommand;
use super::validation::AccountValidation;

pub struct UpdateAccountUseCase {
    account_repo: Arc<dyn AccountRepository>,
    customer_repo: Option<Arc<dyn CustomerRepository>>,
    supplier_repo: Option<Arc<dyn SupplierRepository>>,
    currency_repo: Arc<dyn CurrencyRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl UpdateAccountUseCase {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        customer_repo: Option<Arc<dyn CustomerRepository>>,
        supplier_repo: Option<Arc<dyn SupplierRepository>>,
        currency_repo: Arc<dyn CurrencyRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    ) -> Self {
        Self {
            account_repo,
            customer_repo,
            supplier_repo,
            currency_repo,
            journal_repo,
            opening_migration_repo,
        }
    }

    pub async fn execute(
        &self,
        id: AccountId,
        cmd: CreateAccountCommand,
    ) -> Result<Account, AccountUseCaseError> {
        let opening_balance = Decimal::from_str(&cmd.opening_balance)
            .map_err(|e| AccountUseCaseError::InvalidDecimal(e.to_string()))?;

        let mut account = self
            .account_repo
            .find_by_id(&id)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .ok_or(AccountUseCaseError::AccountNotFound)?;

        let was_root = account.parent_id.is_none();
        let old_code = account.code.clone();
        let old_opening = account.opening_balance;

        AccountValidation::validate_names_and_code(&cmd)?;
        AccountValidation::ensure_code_not_exists(&*self.account_repo, &cmd.code, Some(&id)).await?;
        AccountValidation::validate_parent_and_level(&*self.account_repo, &cmd).await?;
        AccountValidation::validate_type_hierarchy(&*self.account_repo, &cmd).await?;
        
        // Root safety
        AccountValidation::protect_root_policy_on_update(&account, &cmd, was_root)?;

        // Update currency and exchange rate if provided
        if let Some(currency_code) = &cmd.currency {
            let new_currency = self.currency_repo.find_by_code(currency_code).await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                .unwrap_or_else(|| Currency::new(currency_code, currency_code, currency_code, "", 2, false));
            account.currency = new_currency;
        }

        if let Some(er_str) = &cmd.exchange_rate {
            if let Ok(new_er) = Decimal::from_str(er_str) {
                if new_er > Decimal::ZERO {
                    account.exchange_rate = new_er;
                }
            }
        }

        account.code = cmd.code.trim().to_string();
        account.name_ar = cmd.name_ar.trim().to_string();
        account.name_en = cmd.name_en.trim().to_string();
        account.account_type = cmd.account_type;
        account.parent_id = cmd.parent_id;
        account.category = cmd.category;
        account.level = cmd.level;
        account.opening_balance = opening_balance;
        account.notes = cmd.notes.as_ref().map(|n| n.trim().to_string());
        account.linked_customer_id = cmd.linked_customer_id
            .as_deref()
            .and_then(|s| s.parse::<CustomerId>().ok());
        account.linked_supplier_id = cmd.linked_supplier_id
            .as_deref()
            .and_then(|s| s.parse::<SupplierId>().ok());
        account.debit = cmd.debit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(account.debit);
        account.credit = cmd.credit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(account.credit);
        account.balance = account.opening_balance + account.debit - account.credit; // Recalculate balance!
        account.updated_at = Utc::now();

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        // Opening-balance edits must move the GENERAL LEDGER once the opening
        // window is closed, or the tree (fed by posted journals) stays stale.
        // Linked accounts are skipped: their openings are owned by the entity
        // persistence (and the COA form edits linked accounts as identity-only).
        let opening_delta = account.opening_balance - old_opening;
        if opening_delta != Decimal::ZERO
            && account.linked_customer_id.is_none()
            && account.linked_supplier_id.is_none()
        {
            let opening_window = opening_window_active(&self.opening_migration_repo)
                .await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
            let is_receivable_or_payable = account.parent_id.as_ref().map(|p| {
                let pid = p.to_string();
                pid == RECEIVABLES_PARENT_ID || pid == PAYABLES_PARENT_ID
            }).unwrap_or(false);

            if !opening_window && !is_receivable_or_payable {
                // Re-book the account's single opening journal with the CURRENT
                // total on the natural-balance side; the repository refreshes
                // the existing row in place (UNIQUE(source_type, source_id)),
                // so the ledger tracks the opening as it is edited.
                super::opening_journal::book_opening_journal(
                    &account,
                    account.opening_balance.abs(),
                    matches!(
                        account.normal_balance(),
                        domain::accounting::account::NormalBalance::Debit
                    ),
                    &self.account_repo,
                    &self.journal_repo,
                )
                .await?;
            }
        }

        // Update all children accounts if code changed
        if account.code != old_code {
            self.update_children_codes(&account, &old_code, &account.code).await?;
        }

        // Sync with linked customer if any
        if let Some(customer_id) = &account.linked_customer_id {
            if let Some(ref customer_repo) = self.customer_repo {
                if let Ok(Some(mut customer)) = customer_repo.find_by_id(customer_id).await {
                    let debit = cmd.debit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(customer.debit);
                    let credit = cmd.credit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(customer.credit);
                    let currency = cmd.currency.as_deref()
                        .map(|s| Currency::new(s, s, s, "", 2, false))
                        .unwrap_or(customer.currency.clone());

                    let _ = customer.update_info(
                        account.name_ar.clone(),
                        cmd.phone.as_ref().cloned().or(customer.phone.clone()),
                        cmd.address.as_ref().cloned().or(customer.address.clone()),
                        cmd.notes.as_ref().cloned().or(customer.notes.clone()),
                    );
                    customer.debit = debit;
                    customer.credit = credit;
                    customer.currency = currency;
                    customer.opening_balance = account.opening_balance;
                    customer.balance = debit - credit;

                    let _ = customer_repo.save(&customer).await;
                }
            }
        }

        // Sync with linked supplier if any
        if let Some(supplier_id) = &account.linked_supplier_id {
            if let Some(ref supplier_repo) = self.supplier_repo {
                if let Ok(Some(mut supplier)) = supplier_repo.find_by_id(supplier_id).await {
                    let debit = cmd.debit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(supplier.debit);
                    let credit = cmd.credit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(supplier.credit);
                    let currency = cmd.currency.as_deref()
                        .map(|s| Currency::new(s, s, s, "", 2, false))
                        .unwrap_or(supplier.currency.clone());

                    let _ = supplier.update_info(
                        account.name_ar.clone(),
                        cmd.phone.as_ref().cloned().or(supplier.phone.clone()),
                        cmd.address.as_ref().cloned().or(supplier.address.clone()),
                        cmd.notes.as_ref().cloned().or(supplier.notes.clone()),
                    );
                    supplier.debit = debit;
                    supplier.credit = credit;
                    supplier.currency = currency;
                    supplier.opening_balance = account.opening_balance;
                    supplier.balance = credit - debit;

                    let _ = supplier_repo.save(&supplier).await;
                }
            }
        }

        Ok(account)
    }

    async fn update_children_codes(&self, parent: &Account, old_parent_code: &str, new_parent_code: &str) -> Result<(), AccountUseCaseError> {
        let all_accounts = self.account_repo.list_all().await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        
        // Build a map of parent_id -> account ids for quick lookup
        let mut children_map: std::collections::HashMap<Option<String>, Vec<String>> = std::collections::HashMap::new();
        for acc in &all_accounts {
            let parent_id_str = acc.parent_id.as_ref().map(|p| p.to_string());
            children_map.entry(parent_id_str).or_default().push(acc.id.to_string());
        }
        
        // Recursively find all descendant IDs
        fn collect_descendant_ids(
            parent_id: &str,
            children_map: &std::collections::HashMap<Option<String>, Vec<String>>,
            result: &mut Vec<String>
        ) {
            if let Some(child_ids) = children_map.get(&Some(parent_id.to_string())) {
                for child_id in child_ids {
                    result.push(child_id.clone());
                    collect_descendant_ids(child_id, children_map, result);
                }
            }
        }
        
        let mut descendant_ids: Vec<String> = Vec::new();
        collect_descendant_ids(&parent.id.to_string(), &children_map, &mut descendant_ids);
        
        // Create a map of id -> Account for quick lookup
        let account_map: std::collections::HashMap<String, Account> = all_accounts.into_iter()
            .map(|a| (a.id.to_string(), a))
            .collect();
        
        // Update each child's code based on parent's new code
        for child_id in descendant_ids {
            if let Some(child) = account_map.get(&child_id) {
                let old_child_code = &child.code;
                
                if let Some(suffix) = old_child_code.strip_prefix(old_parent_code) {
                    let new_child_code = format!("{}{}", new_parent_code, suffix);
                    
                    let mut updated_child = child.clone();
                    updated_child.code = new_child_code;
                    updated_child.updated_at = Utc::now();
                    
                    let _ = self.account_repo.save(&updated_child).await;
                }
            }
        }
        
        Ok(())
    }
}
