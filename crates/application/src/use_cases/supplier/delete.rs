use std::sync::Arc;
use domain::shared::ids::SupplierId;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::errors::AppError;

pub struct DeleteSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeleteSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { supplier_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let sid = id.parse::<SupplierId>().map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;

        let supplier = self.supplier_repo.find_by_id(&sid).await?;

        if let Some(ref supplier) = supplier {
            if let Some(ref account_id) = &supplier.account_id {
                // Cascade: delete all journal entries referencing this account.
                // Only drafts may be removed; posted history is immutable.
                let entries = self.journal_repo.list_by_account(account_id).await?;
                crate::use_cases::journal::guards::ensure_deletable(&entries)?;
                for entry in &entries {
                    self.journal_repo.delete(&entry.id).await?;
                }
                self.account_repo.delete(account_id).await?;
            }
        }

        self.supplier_repo.delete(&sid).await
    }
}
