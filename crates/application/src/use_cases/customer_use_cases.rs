use std::sync::Arc;
use uuid::Uuid;
use domain::customers::Customer;
use domain::shared::ids::{AccountId, CustomerId};
use domain::shared::Currency;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::customer_dto::{CreateCustomerRequest, UpdateCustomerRequest, CustomerDto};
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;

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
        // Pre-generate customer ID so we can use it as the code
        let customer_id = CustomerId::new();

        // Code = numeric ID (always > 1, never "CUST-*")
        let code = if req.code.trim().is_empty() {
            customer_id.0.to_string()
        } else {
            req.code.clone()
        };

        let debit = req.debit
            .as_deref()
            .map(Decimal::from_str)
            .transpose()
            .map_err(|e| AppError::Invalid(format!("قيمة المدين غير صالحة: {}", e)))?
            .unwrap_or(Decimal::ZERO);

        let credit = req.credit
            .as_deref()
            .map(Decimal::from_str)
            .transpose()
            .map_err(|e| AppError::Invalid(format!("قيمة الدائن غير صالحة: {}", e)))?
            .unwrap_or(Decimal::ZERO);

        let opening_balance = req.opening_balance
            .as_deref()
            .map(Decimal::from_str)
            .transpose()
            .map_err(|e| AppError::Invalid(format!("رصيد الافتتاح غير صالح: {}", e)))?
            .unwrap_or(Decimal::ZERO);

        let currency = match req.currency.as_deref() {
            Some("USD") => Currency::USD,
            _ => Currency::SYP,
        };

        // Create customer with pre-generated ID
        let mut customer = Customer::new_with_id(
            customer_id,
            code,
            req.name.clone(),
            req.phone.clone(),
            req.address.clone(),
            None, // account_id will be set after account creation
            debit,
            credit,
            opening_balance,
            currency,
            req.notes.clone(),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.customer_repo.save(&customer).await?;

        // Account code = "123" + customer_id  (e.g. customer_id=2 → account code=1232)
        let account_code = format!("123{}", customer_id);

        // Find parent account "123" (المدينون (العملاء والزبائن))
        let parent = self.account_repo.find_by_code("123").await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(parent) = parent {
            let existing_account = self.account_repo.find_by_code(&account_code).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            if let Some(existing) = existing_account {
                // Link existing account to customer
                customer.link_account(existing.id.clone());
                self.customer_repo.save(&customer).await?;
            } else {
                // Create new account named exactly like the customer (no prefix)
                let new_account = domain::accounting::account::Account {
                    id: domain::shared::ids::AccountId::new(),
                    code: account_code.clone(),
                    name_ar: req.name.clone(),
                    name_en: req.name.clone(),
                    account_type: domain::accounting::account::AccountType::Assets,
                    parent_id: Some(parent.id),
                    category: domain::accounting::account::AccountCategory::Detail,
                    level: parent.level + 1,
                    opening_balance,
                    balance: debit - credit,
                    notes: None,
                    is_active: true,
                    is_default: false,
                    is_final: true,
                    linked_customer_id: Some(customer_id),
                    linked_supplier_id: None,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                };

                self.account_repo.save(&new_account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

                let new_account_id = new_account.id.clone();
                customer.link_account(new_account_id);
                self.customer_repo.save(&customer).await?;
            }
        }

        Ok(CustomerDto::from(customer))
    }
}

pub struct UpdateCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl UpdateCustomerUseCase {
    pub fn new(
        customer_repo: Arc<dyn CustomerRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { customer_repo, account_repo }
    }

    pub async fn execute(&self, req: UpdateCustomerRequest) -> Result<CustomerDto, AppError> {
        let cid = req.id.parse::<u64>().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let cid = CustomerId::from_u64(cid);
        let mut customer = self.customer_repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;

        customer.update_info(req.name.clone(), req.phone.clone(), req.address.clone(), req.notes.clone())
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        // Update code if provided
        if !req.code.trim().is_empty() {
            customer.code = req.code;
        }

        // Update account_id if provided
        if let Some(ref acc_id_str) = req.account_id {
            let account_id = Uuid::parse_str(acc_id_str)
                .map(AccountId)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            customer.link_account(account_id);
        }

        // Update debit/credit if provided
        if let Some(ref d) = req.debit {
            let debit = Decimal::from_str(d)
                .map_err(|e| AppError::Invalid(format!("قيمة المدين غير صالحة: {}", e)))?;
            customer.debit = debit;
            customer.balance = customer.debit - customer.credit;
        }
        if let Some(ref c) = req.credit {
            let credit = Decimal::from_str(c)
                .map_err(|e| AppError::Invalid(format!("قيمة الدائن غير صالحة: {}", e)))?;
            customer.credit = credit;
            customer.balance = customer.debit - customer.credit;
        }

        // Update opening balance if provided
        if let Some(ref ob) = req.opening_balance {
            customer.opening_balance = Decimal::from_str(ob)
                .map_err(|e| AppError::Invalid(format!("رصيد الافتتاح غير صالح: {}", e)))?;
        }

        // Update currency if provided
        if let Some(ref cur) = req.currency {
            customer.currency = match cur.as_str() {
                "USD" => Currency::USD,
                _ => Currency::SYP,
            };
        }

        if req.is_active {
            customer.activate();
        } else {
            customer.deactivate();
        }

        self.customer_repo.update(&customer).await?;

        // Sync account name and balance when customer info changes
        if let Some(ref account_id) = &customer.account_id {
            if let Some(mut account) = self.account_repo.find_by_id(account_id).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))? {
                account.name_ar = customer.name.clone();
                account.name_en = customer.name.clone();
                account.balance = customer.balance;
                account.updated_at = chrono::Utc::now();
                self.account_repo.save(&account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
        }

        Ok(CustomerDto::from(customer))
    }
}

pub struct ListCustomersUseCase {
    repo: Arc<dyn CustomerRepository>,
}

impl ListCustomersUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<CustomerDto>, AppError> {
        let customers = self.repo.list_all().await?;
        Ok(customers.into_iter().map(CustomerDto::from).collect())
    }
}

pub struct GetCustomerUseCase {
    repo: Arc<dyn CustomerRepository>,
}

impl GetCustomerUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<CustomerDto, AppError> {
        let cid = id.parse::<u64>().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let cid = CustomerId::from_u64(cid);
        let customer = self.repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;

        Ok(CustomerDto::from(customer))
    }
}

pub struct DeleteCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl DeleteCustomerUseCase {
    pub fn new(customer_repo: Arc<dyn CustomerRepository>, account_repo: Arc<dyn AccountRepository>) -> Self {
        Self { customer_repo, account_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let cid = id.parse::<u64>().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let cid = CustomerId::from_u64(cid);

        // Get customer to find linked account
        let customer = self.customer_repo.find_by_id(&cid).await?;

        // Delete linked account if exists (cascade delete from CoA)
        if let Some(ref customer) = customer {
            if let Some(ref account_id) = &customer.account_id {
                let _ = self.account_repo.delete(account_id).await;
            }
        }

        self.customer_repo.delete(&cid).await
    }
}
