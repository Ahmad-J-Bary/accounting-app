use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::accounting::account::Account;
use domain::shared::currency::Currency;
use domain::shared::ids::{AccountId, CustomerId, SupplierId};
use domain::customers::Customer;
use domain::suppliers::Supplier;

use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::constants::{RECEIVABLES_PARENT_ID, PAYABLES_PARENT_ID};

use super::error::AccountUseCaseError;
use super::types::CreateAccountCommand;
use super::validation::AccountValidation;

pub struct CreateAccountUseCase {
    account_repo: Arc<dyn AccountRepository>,
    customer_repo: Option<Arc<dyn CustomerRepository>>,
    supplier_repo: Option<Arc<dyn SupplierRepository>>,
}

impl CreateAccountUseCase {
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
        cmd: CreateAccountCommand,
    ) -> Result<Account, AccountUseCaseError> {
        let opening_balance = Decimal::from_str(&cmd.opening_balance)
            .map_err(|e| AccountUseCaseError::InvalidDecimal(e.to_string()))?;

        AccountValidation::validate_names_and_code(&cmd)?;
        AccountValidation::ensure_code_not_exists(&*self.account_repo, &cmd.code, None).await?;
        AccountValidation::validate_parent_and_level(&*self.account_repo, &cmd).await?;
        AccountValidation::validate_type_hierarchy(&*self.account_repo, &cmd).await?;
        AccountValidation::protect_root_policy_on_create(&cmd)?;

        let linked_customer_id = cmd.linked_customer_id
            .as_deref()
            .and_then(|s| s.parse::<CustomerId>().ok());

        let linked_supplier_id = cmd.linked_supplier_id
            .as_deref()
            .and_then(|s| s.parse::<SupplierId>().ok());

        let final_name_ar = cmd.name_ar.trim().to_string();

        let is_final = cmd.category == domain::accounting::account::AccountCategory::Detail;

        let account = Account {
            id: AccountId::new(),
            code: cmd.code.trim().to_string(),
            name_ar: final_name_ar,
            name_en: cmd.name_en.trim().to_string(),
            account_type: cmd.account_type,
            parent_id: cmd.parent_id,
            category: cmd.category,
            level: cmd.level,
            opening_balance,
            balance: opening_balance,
            notes: cmd.notes.as_ref().map(|n| n.trim().to_string()),
            is_active: true,
            is_default: false,
            is_final,
            linked_customer_id,
            linked_supplier_id,
            debit: cmd.debit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(Decimal::ZERO),
            credit: cmd.credit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(Decimal::ZERO),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        let debit = cmd.debit.as_deref()
            .and_then(|s| Decimal::from_str(s).ok())
            .unwrap_or(Decimal::ZERO);
        let credit = cmd.credit.as_deref()
            .and_then(|s| Decimal::from_str(s).ok())
            .unwrap_or(Decimal::ZERO);
        let currency = cmd.currency.as_deref()
            .map(|s| if s == "USD" { Currency::usd() } else { Currency::syp() })
            .unwrap_or(Currency::syp());

        // Auto-create customer if account is under Receivables Parent
        let is_receivable = cmd.parent_id.as_ref().map(|p| p.to_string() == RECEIVABLES_PARENT_ID).unwrap_or(false);
        if is_receivable {
            if let Some(ref customer_repo) = self.customer_repo {
                // Extract customer number: suffix of the code
                let parent_code = self.account_repo.find_by_id(cmd.parent_id.as_ref().unwrap()).await.ok().flatten().map(|p| p.code).unwrap_or_default();
                let customer_num = if account.code.starts_with(&parent_code) { &account.code[parent_code.len()..] } else { &account.code };
                
                let customer_id = CustomerId::new();

                let customer = Customer::new_with_id(
                    customer_id,
                    customer_num.to_string(),
                    account.name_ar.clone(),
                    cmd.phone.clone(),
                    cmd.address.clone(),
                    Some(account.id),
                    debit,
                    credit,
                    account.opening_balance,
                    currency.clone(),
                    cmd.notes.clone(),
                );

                if let Ok(customer) = customer {
                    let _ = customer_repo.save(&customer).await;
                    let mut updated_account = account.clone();
                    updated_account.linked_customer_id = Some(customer.id);
                    let _ = self.account_repo.save(&updated_account).await;
                }
            }
        }

        // Auto-create supplier if account is under Payables Parent
        let is_payable = cmd.parent_id.as_ref().map(|p| p.to_string() == PAYABLES_PARENT_ID).unwrap_or(false);
        if is_payable {
            if let Some(ref supplier_repo) = self.supplier_repo {
                // Extract supplier number: suffix of the code
                let parent_code = self.account_repo.find_by_id(cmd.parent_id.as_ref().unwrap()).await.ok().flatten().map(|p| p.code).unwrap_or_default();
                let supplier_num = if account.code.starts_with(&parent_code) { &account.code[parent_code.len()..] } else { &account.code };
                
                let supplier_id = SupplierId::new();

                let supplier = Supplier::new_with_id(
                    supplier_id,
                    supplier_num.to_string(),
                    account.name_ar.clone(),
                    cmd.phone.clone(),
                    cmd.address.clone(),
                    Some(account.id),
                    debit,
                    credit,
                    account.opening_balance,
                    currency.clone(),
                    cmd.notes.clone(),
                );

                if let Ok(supplier) = supplier {
                    let _ = supplier_repo.save(&supplier).await;
                    let mut updated_account = account.clone();
                    updated_account.linked_supplier_id = Some(supplier.id);
                    let _ = self.account_repo.save(&updated_account).await;
                }
            }
        }

        Ok(account)
    }
}
