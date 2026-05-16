use std::sync::Arc;
use domain::shared::ids::CustomerId;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::errors::AppError;

pub struct DeleteCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeleteCustomerUseCase {
    pub fn new(
        customer_repo: Arc<dyn CustomerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { customer_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let cid = id.parse::<CustomerId>().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;

        let customer = self.customer_repo.find_by_id(&cid).await?;

        if let Some(ref customer) = customer {
            if let Some(ref account_id) = &customer.account_id {
                // Cascade: delete all journal entries referencing this account
                let entries = self.journal_repo.list_by_account(account_id).await?;
                for entry in &entries {
                    self.journal_repo.delete(&entry.id).await?;
                }
                self.account_repo.delete(account_id).await?;
            }
        }

        self.customer_repo.delete(&cid).await
    }
}
