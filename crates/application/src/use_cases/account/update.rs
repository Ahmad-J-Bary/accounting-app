use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::accounting::account::Account;
use domain::shared::currency::Currency;
use domain::shared::ids::{AccountId, CustomerId, SupplierId};

use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;

use super::error::AccountUseCaseError;
use super::types::CreateAccountCommand;
use super::validation::AccountValidation;

pub struct UpdateAccountUseCase {
    account_repo: Arc<dyn AccountRepository>,
    customer_repo: Option<Arc<dyn CustomerRepository>>,
    supplier_repo: Option<Arc<dyn SupplierRepository>>,
}

impl UpdateAccountUseCase {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        customer_repo: Option<Arc<dyn CustomerRepository>>,
        supplier_repo: Option<Arc<dyn SupplierRepository>>,
    ) -> Self {
        Self {
            account_repo,
            customer_repo,
            supplier_repo,
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

        AccountValidation::validate_names_and_code(&cmd)?;
        AccountValidation::ensure_code_not_exists(&*self.account_repo, &cmd.code, Some(&id)).await?;
        AccountValidation::validate_parent_and_level(&*self.account_repo, &cmd).await?;
        AccountValidation::validate_type_hierarchy(&*self.account_repo, &cmd).await?;
        
        // Root safety
        AccountValidation::protect_root_policy_on_update(&account, &cmd, was_root)?;

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
        account.updated_at = Utc::now();

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

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
                    supplier.balance = debit - credit;

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
