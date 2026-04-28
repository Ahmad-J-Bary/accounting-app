use std::sync::Arc;
use domain::shared::ids::CustomerId;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::errors::AppError;

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

        let customer = self.customer_repo.find_by_id(&cid).await?;

        if let Some(ref customer) = customer {
            if let Some(ref account_id) = &customer.account_id {
                let _ = self.account_repo.delete(account_id).await;
            }
        }

        self.customer_repo.delete(&cid).await
    }
}
