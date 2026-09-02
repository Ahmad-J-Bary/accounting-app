use crate::errors::AppError;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::shared::ids::CustomerId;
use std::sync::Arc;

pub struct DeleteCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeleteCustomerUseCase {
    pub fn new(
        customer_repo: Arc<dyn CustomerRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            customer_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let cid = id
            .parse::<CustomerId>()
            .map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;

        let customer = self.customer_repo.find_by_id(&cid).await?;

        let (account_id, entry_ids) = if let Some(ref customer) = customer {
            if let Some(ref account_id) = &customer.account_id {
                // Gather the deletable journal entries referencing this account.
                // Only drafts may be removed; posted history is immutable, and
                // `ensure_deletable` rejects the whole delete if any survive.
                let entries = self.journal_repo.list_by_account(account_id).await?;
                crate::use_cases::journal::guards::ensure_deletable(&entries)?;
                let entry_ids = entries.iter().map(|e| e.id).collect::<Vec<_>>();
                (Some(*account_id), entry_ids)
            } else {
                (None, Vec::new())
            }
        } else {
            return Err(AppError::NotFound("العميل غير موجود".into()));
        };

        // Cascade customer + account + draft journals in ONE transaction
        self.customer_repo
            .delete_with_accounting(&cid, account_id.as_ref(), &entry_ids)
            .await
    }
}
