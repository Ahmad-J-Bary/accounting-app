use std::sync::Arc;

use domain::shared::ids::PaymentId;
use crate::errors::AppError;
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use super::helpers::{
    build_monetary_amount,
    compute_reverse_balances,
    compute_reverse_return_balances,
};

pub struct DeletePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeletePaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let pid = id.parse::<PaymentId>()
            .map_err(|_| AppError::Invalid("معرف السند غير صالح".into()))?;

        let payment = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("السند غير موجود".into()))?;

        let (amount_ma, _) = build_monetary_amount(
            payment.amount,
            &payment.currency_code,
            payment.exchange_rate,
        );
        let base_amount = amount_ma.base_amount;

        let is_return = payment.reference.as_deref().is_some_and(|r| r.starts_with("return:"));

        // Compute reversed entity balance changes (not persisted yet)
        let changes = if !is_return {
            let is_settlement = payment.reference.as_deref() == Some("settlement");
            compute_reverse_balances(
                &payment.payment_type,
                base_amount,
                &payment.customer_id,
                &payment.supplier_id,
                &payment.debit_account_id,
                &self.customer_repo,
                &self.supplier_repo,
                &self.account_repo,
                is_settlement,
            ).await?
        } else {
            compute_reverse_return_balances(
                &payment.payment_type,
                base_amount,
                &payment.customer_id,
                &payment.supplier_id,
                &self.customer_repo,
                &self.supplier_repo,
            ).await?
        };

        // Delete associated journal entry — only drafts may be removed directly.
        // Posted entries must go through a reversal; treat them as a hard stop.
        let entries = match payment.reference.as_deref().is_some_and(|r| r.starts_with("return:")) {
            true => match &payment.journal_entry_number {
                Some(number) => self.journal_repo.find_by_number(number).await?
                    .into_iter().collect::<Vec<_>>(),
                None => Vec::new(),
            },
            false => self.journal_repo.find_by_source_id(&pid.to_string()).await?
                .into_iter().collect::<Vec<_>>(),
        };
        crate::use_cases::journal::guards::ensure_deletable(&entries)?;
        let entry_ids = entries.into_iter().map(|e| e.id).collect::<Vec<_>>();

        self.repo.delete_with_accounting(
            &pid,
            &entry_ids,
            &changes.customers,
            &changes.suppliers,
            &changes.accounts,
        ).await
    }
}
