use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::supplier_repository::SupplierRepository;
use domain::shared::ids::SupplierId;
use std::sync::Arc;

pub struct DeleteSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeleteSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            supplier_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let sid = id
            .parse::<SupplierId>()
            .map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;

        let supplier = self.supplier_repo.find_by_id(&sid).await?;

        let (account_id, entry_ids) = if let Some(ref supplier) = supplier {
            if let Some(ref account_id) = &supplier.account_id {
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
            return Err(AppError::NotFound("المورد غير موجود".into()));
        };

        // Cascade supplier + account + draft journals in ONE transaction
        self.supplier_repo
            .delete_with_accounting(&sid, account_id.as_ref(), &entry_ids)
            .await
    }
}
