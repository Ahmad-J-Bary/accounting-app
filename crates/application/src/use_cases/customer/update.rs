use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use uuid::Uuid;
use domain::shared::ids::{AccountId, CustomerId};
use domain::shared::currency::Currency;

use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::customer_dto::{UpdateCustomerRequest, CustomerDto};
use crate::errors::AppError;

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

        if !req.code.trim().is_empty() {
            customer.code = req.code;
        }

        if let Some(ref acc_id_str) = req.account_id {
            let account_id = Uuid::parse_str(acc_id_str)
                .map(AccountId)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            customer.link_account(account_id);
        }

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

        if let Some(ref ob) = req.opening_balance {
            customer.opening_balance = Decimal::from_str(ob)
                .map_err(|e| AppError::Invalid(format!("رصيد الافتتاح غير صالح: {}", e)))?;
        }

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

        if let Some(ref account_id) = &customer.account_id {
            if let Some(mut account) = self.account_repo.find_by_id(account_id).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))? {
                account.name_ar = customer.name.clone();
                account.name_en = customer.name.clone();
                account.balance = customer.balance;
                account.updated_at = Utc::now();
                self.account_repo.save(&account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
        }

        Ok(CustomerDto::from(customer))
    }
}
