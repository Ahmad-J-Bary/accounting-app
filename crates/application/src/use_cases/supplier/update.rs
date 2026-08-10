use std::sync::Arc;
use chrono::Utc;
use domain::shared::ids::{AccountId, SupplierId};

use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::supplier_dto::{UpdateSupplierRequest, SupplierDto};
use crate::errors::AppError;
use crate::use_cases::shared::partner_account::{PartnerKind, build_balance_adjustment_entry};

pub struct UpdateSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl UpdateSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { supplier_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, req: UpdateSupplierRequest) -> Result<SupplierDto, AppError> {
        let sid = req.id.parse::<SupplierId>()
            .map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;
        let mut supplier = self.supplier_repo.find_by_id(&sid).await?
            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;

        let old_debit = supplier.debit;
        let old_credit = supplier.credit;

        supplier.update_info(req.name.clone(), req.phone.clone(), req.address.clone(), req.notes.clone())
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        supplier.code = crate::utils::ensure_code(Some(req.code), supplier.code);

        if let Some(ref acc_id_str) = req.account_id {
            let account_id = acc_id_str.parse::<AccountId>()
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            supplier.link_account(account_id);
        }

        if let Some(ref d) = req.debit {
            supplier.debit = crate::utils::parse_decimal(Some(d), "المدين")?;
            supplier.balance = supplier.credit - supplier.debit;
        }
        if let Some(ref c) = req.credit {
            supplier.credit = crate::utils::parse_decimal(Some(c), "الدائن")?;
            supplier.balance = supplier.credit - supplier.debit;
        }

        if let Some(ref ob) = req.opening_balance {
            supplier.opening_balance = crate::utils::parse_decimal(Some(ob), "رصيد الافتتاح")?;
        }

        if let Some(ref cur) = req.currency {
            supplier.currency = crate::utils::parse_currency(Some(cur));
        }

        // balance = credit − debit for suppliers
        let new_balance = supplier.credit - supplier.debit;
        let old_balance = old_credit - old_debit;
        let balance_change = new_balance - old_balance;

        // Sync the linked account name/balance in memory (persisted atomically below)
        let mut synced_account = None;
        if let Some(ref account_id) = &supplier.account_id {
            let mut account = self.account_repo.find_by_id(account_id).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("معرف الحساب غير صالح".into()))?;
            account.name_ar = supplier.name.clone();
            account.name_en = supplier.name.clone();
            account.balance = supplier.balance;
            account.updated_at = Utc::now();
            synced_account = Some(account);
        }

        // Build the balance-adjustment journal entry in memory (no write yet).
        // Only partners that actually have a linked ledger account produce one.
        let adjustment_entry = if let Some(account) = synced_account.as_ref() {
            build_balance_adjustment_entry(
                account.id,
                &supplier.name,
                &supplier.id.to_string(),
                balance_change,
                PartnerKind::Supplier,
                &self.account_repo,
                &self.journal_repo,
            ).await?
        } else {
            None
        };

        let mut entries = Vec::new();
        if let Some(entry) = adjustment_entry {
            entries.push(entry);
        }

        // Persist supplier + account sync + adjustment journal in ONE txn
        self.supplier_repo
            .update_with_accounting(&supplier, synced_account.as_ref(), &entries)
            .await?;

        Ok(SupplierDto::from(supplier))
    }
}
