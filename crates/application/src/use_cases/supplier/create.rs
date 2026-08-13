use domain::shared::ids::SupplierId;
use domain::shared::Currency;
use domain::suppliers::Supplier;
use rust_decimal::Decimal;
use std::sync::Arc;
use std::str::FromStr;

use crate::dto::supplier_dto::{CreateSupplierRequest, SupplierDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::constants::PAYABLES_PARENT_ID;
use crate::use_cases::opening_balance::opening_window_active;
use crate::use_cases::shared::partner_account::{
    PartnerAccountParams, PartnerKind,
    build_partner_account, build_opening_balance_entry,
};

pub struct CreateSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl CreateSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    ) -> Self {
        Self { supplier_repo, account_repo, journal_repo, opening_migration_repo }
    }

    pub async fn execute(&self, req: CreateSupplierRequest) -> Result<SupplierDto, AppError> {
        let supplier_id = SupplierId::new();

        // Sequential code (0 is reserved for cash supplier)
        let next_num = self.supplier_repo.get_next_supplier_number().await?;
        let code = next_num.to_string();

        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance = crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;

        let currency_code = req.currency.clone().unwrap_or_default();
        let currency = Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
        let fx_rate = if currency.is_base {
            Decimal::ONE
        } else {
            req.exchange_rate
                .as_deref()
                .and_then(|s| Decimal::from_str(s).ok())
                .filter(|r| *r > Decimal::ZERO)
                .unwrap_or(Decimal::ONE)
        };

        let mut supplier = Supplier::new_with_id(
            supplier_id,
            code.clone(),
            req.name.clone(),
            req.phone.clone(),
            req.address.clone(),
            None,
            debit,
            credit,
            opening_balance,
            currency.clone(),
            req.notes.clone(),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        // Build the linked ledger account in memory (no write yet). While an
        // opening-balance migration window is open the account is created with
        // a static zero opening — the migration's aggregate journal owns the
        // ledger — so the real entity is created by the SAME module in both
        // company lifecycles.
        let opening_window = opening_window_active(&self.opening_migration_repo).await?;
        let (static_opening, static_debit, static_credit) = if opening_window {
            (Decimal::ZERO, Decimal::ZERO, Decimal::ZERO)
        } else {
            (opening_balance, debit, credit)
        };
        let (new_account, new_account_id) = build_partner_account(
            PartnerAccountParams {
                partner_id_str: supplier_id.to_string(),
                code: &code,
                code_for_account: &code,
                name: &req.name,
                opening_balance: static_opening,
                debit: static_debit,
                credit: static_credit,
                currency: currency.clone(),
                fx_rate,
                parent_account_id: PAYABLES_PARENT_ID,
                kind: PartnerKind::Supplier,
            },
            &self.account_repo,
        ).await?;

        supplier.link_account(new_account_id);

        // Build the opening balance journal entry in memory (no write yet).
        // For suppliers: net_balance = credit − debit (positive = we owe them).
        // During an opening window the posting is deferred to the migration so
        // a per-entity journal never double-counts the same balance (R1).
        let net_balance = credit - debit;
        let opening_entry = if opening_window || net_balance.is_zero() {
            None
        } else {
            build_opening_balance_entry(
                new_account_id,
                &supplier.name,
                &supplier.id.to_string(),
                net_balance,
                currency,
                fx_rate,
                "53",
                PartnerKind::Supplier,
                &self.account_repo,
                &self.journal_repo,
            ).await?
        };

        let mut entries = Vec::new();
        if let Some(entry) = opening_entry {
            entries.push(entry);
        }

        // Persist supplier + account + opening-balance journal in ONE txn
        self.supplier_repo
            .save_with_accounting(&supplier, &new_account, &entries)
            .await?;

        Ok(SupplierDto::from(supplier))
    }
}
