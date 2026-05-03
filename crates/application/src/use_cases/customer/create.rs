use std::sync::Arc;
use domain::customers::Customer;
use domain::shared::ids::{AccountId, CustomerId};
use domain::accounting::account::{Account, AccountType, AccountCategory};
use chrono::Utc;

use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::customer_dto::{CreateCustomerRequest, CustomerDto};
use crate::errors::AppError;

pub struct CreateCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl CreateCustomerUseCase {
    pub fn new(
        customer_repo: Arc<dyn CustomerRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { customer_repo, account_repo }
    }

    pub async fn execute(&self, req: CreateCustomerRequest) -> Result<CustomerDto, AppError> {
        let customer_id = CustomerId::new();
        let code = crate::utils::ensure_code(Some(req.code), customer_id.to_string());
        
        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance = crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;
        let currency = crate::utils::parse_currency(req.currency.as_deref());

        let mut customer = Customer::new_with_id(
            customer_id,
            code,
            req.name.clone(),
            req.phone.clone(),
            req.address.clone(),
            None,
            debit,
            credit,
            opening_balance,
            currency,
            req.notes.clone(),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.customer_repo.save(&customer).await?;

        let account_code = self.account_repo.get_next_child_code("123").await?;

        let parent = self.account_repo.find_by_code("123").await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(parent) = parent {
            let existing_account = self.account_repo.find_by_code(&account_code).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            if let Some(existing) = existing_account {
                customer.link_account(existing.id);
                self.customer_repo.save(&customer).await?;
            } else {
                let new_account = Account {
                    id: AccountId::new(),
                    code: account_code.clone(),
                    name_ar: req.name.clone(),
                    name_en: req.name.clone(),
                    account_type: AccountType::Assets,
                    parent_id: Some(parent.id),
                    category: AccountCategory::Detail,
                    level: parent.level + 1,
                    opening_balance,
                    balance: debit - credit,
                    notes: None,
                    is_active: true,
                    is_default: false,
                    is_final: true,
                    linked_customer_id: Some(customer_id),
                    linked_supplier_id: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                self.account_repo.save(&new_account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

                let new_account_id = new_account.id;
                customer.link_account(new_account_id);
                self.customer_repo.save(&customer).await?;
            }
        }

        Ok(CustomerDto::from(customer))
    }
}
