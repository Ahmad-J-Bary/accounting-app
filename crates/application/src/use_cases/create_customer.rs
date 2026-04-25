use std::sync::Arc;
use domain::customers::Customer;
use domain::shared::Currency;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::customer_dto::{CreateCustomerRequest, CustomerDto};
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;

pub struct CreateCustomerUseCase {
    repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl CreateCustomerUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>, account_repo: Arc<dyn AccountRepository>) -> Self {
        Self { repo, account_repo }
    }

    pub async fn execute(&self, req: CreateCustomerRequest) -> Result<CustomerDto, AppError> {
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

        let account_id = req.account_id
            .as_deref()
            .and_then(|s| uuid::Uuid::parse_str(s).ok())
            .map(domain::shared::ids::AccountId);

        let customer = Customer::new(
            req.code,
            req.name,
            req.phone,
            req.address,
            account_id,
            debit,
            credit,
            opening_balance,
            currency,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&customer).await?;

        Ok(CustomerDto::from(customer))
    }
}
