use std::sync::Arc;
use chrono::Utc;
use domain::shared::ids::{AccountId, CustomerId};

use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::dto::customer_dto::{UpdateCustomerRequest, CustomerDto};
use crate::errors::AppError;
use crate::use_cases::opening_balance::opening_window_active;
use crate::use_cases::shared::partner_account::{PartnerKind, build_balance_adjustment_entry};

pub struct UpdateCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl UpdateCustomerUseCase {
    pub fn new(
        customer_repo: Arc<dyn CustomerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    ) -> Self {
        Self { customer_repo, account_repo, journal_repo, opening_migration_repo }
    }

    pub async fn execute(&self, req: UpdateCustomerRequest) -> Result<CustomerDto, AppError> {
        let cid = req.id.parse::<CustomerId>()
            .map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let mut customer = self.customer_repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;

        let old_debit = customer.debit;
        let old_credit = customer.credit;

        customer.update_info(req.name.clone(), req.phone.clone(), req.address.clone(), req.notes.clone())
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        customer.code = crate::utils::ensure_code(Some(req.code), customer.code);

        if let Some(ref acc_id_str) = req.account_id {
            let account_id = acc_id_str.parse::<AccountId>()
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            customer.link_account(account_id);
        }

        if let Some(ref d) = req.debit {
            customer.debit = crate::utils::parse_decimal(Some(d), "المدين")?;
            customer.balance = customer.debit - customer.credit;
        }
        if let Some(ref c) = req.credit {
            customer.credit = crate::utils::parse_decimal(Some(c), "الدائن")?;
            customer.balance = customer.debit - customer.credit;
        }

        if let Some(ref ob) = req.opening_balance {
            customer.opening_balance = crate::utils::parse_decimal(Some(ob), "رصيد الافتتاح")?;
        }

        if let Some(ref cur) = req.currency {
            customer.currency = crate::utils::parse_currency(Some(cur));
        }

        if req.is_active {
            customer.activate();
        } else {
            customer.deactivate();
        }

        // balance = debit − credit for customers
        let new_balance = customer.debit - customer.credit;
        let old_balance = old_debit - old_credit;
        let balance_change = new_balance - old_balance;

        // While an opening-balance migration window is open the migration's
        // aggregate journal owns the ledger (same rule as partner create). The
        // linked account stays static (no balance drift) and no per-entity
        // balance-adjustment journal is posted — a later real journal would
        // double-count the same opening balance (R1). Entity edits such as the
        // opening balance are still persisted; they feed the wizard derivation.
        let opening_window = opening_window_active(&self.opening_migration_repo).await?;

        // Sync the linked account name in memory (persisted atomically below).
        // During the window the balance keeps its static value.
        let mut synced_account = None;
        if let Some(ref account_id) = &customer.account_id {
            let mut account = self.account_repo.find_by_id(account_id).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("معرف الحساب غير صالح".into()))?;
            account.name_ar = customer.name.clone();
            account.name_en = customer.name.clone();
            if !opening_window {
                account.balance = customer.balance;
            }
            account.updated_at = Utc::now();
            synced_account = Some(account);
        }

        // Build the balance-adjustment journal entry in memory (no write yet).
        // Deferred to the migration while the opening window is open; only
        // partners that actually have a linked ledger account produce one.
        let adjustment_entry = if !opening_window {
            if let Some(account) = synced_account.as_ref() {
                build_balance_adjustment_entry(
                    account.id,
                    &customer.name,
                    &customer.id.to_string(),
                    balance_change,
                    PartnerKind::Customer,
                    &self.account_repo,
                    &self.journal_repo,
                ).await?
            } else {
                None
            }
        } else {
            None
        };

        let mut entries = Vec::new();
        if let Some(entry) = adjustment_entry {
            entries.push(entry);
        }

        // Persist customer + account sync + adjustment journal in ONE txn
        self.customer_repo
            .update_with_accounting(&customer, synced_account.as_ref(), &entries)
            .await?;

        Ok(CustomerDto::from(customer))
    }
}
