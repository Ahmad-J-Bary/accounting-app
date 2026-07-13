use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::accounting::journal_entry::JournalEntry;
use domain::payments::Payment;
use domain::shared::ids::{CustomerId, SupplierId, AccountId, PaymentId};
use domain::shared::MonetaryAmount;
use crate::dto::payment_dto::{UpdatePaymentRequest, PaymentDto};
use crate::errors::AppError;
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use super::helpers::{
    enrich_payment,
    build_monetary_amount,
    apply_entity_balances,
    reverse_entity_balances,
    apply_return_entity_balances,
    reverse_return_entity_balances,
};
use super::journal_builder::{
    parse_payment_type,
    payment_type_to_journal_type,
    build_journal_lines,
};

pub struct UpdatePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl UpdatePaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo, journal_repo, account_repo }
    }

    pub async fn execute(&self, req: UpdatePaymentRequest) -> Result<PaymentDto, AppError> {
        let pid = req.id.parse::<PaymentId>()
            .map_err(|_| AppError::Invalid("معرف السند غير صالح".into()))?;

        let existing = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("السند غير موجود".into()))?;

        // Capture old state before modification
        let old_type = existing.payment_type;
        let (old_amount_ma, _) = build_monetary_amount(existing.amount, &existing.currency_code, existing.exchange_rate);
        let old_base_amount = old_amount_ma.base_amount;
        let old_customer_id = existing.customer_id;
        let old_supplier_id = existing.supplier_id;
        let old_debit_account_id = existing.debit_account_id;
        let is_return = existing.reference.as_deref().is_some_and(|r| r.starts_with("return:"));

        // 1. Reverse old entity balances
        if !is_return {
            let is_settlement = existing.reference.as_deref() == Some("settlement");
            reverse_entity_balances(
                &old_type,
                old_base_amount,
                &old_customer_id,
                &old_supplier_id,
                &old_debit_account_id,
                &self.customer_repo,
                &self.supplier_repo,
                &self.account_repo,
                is_settlement,
            ).await?;
        } else {
            reverse_return_entity_balances(
                &old_type,
                old_base_amount,
                &old_customer_id,
                &old_supplier_id,
                &self.customer_repo,
                &self.supplier_repo,
            ).await?;
        }

        // 2. Delete old journal entry
        if existing.reference.as_deref().is_some_and(|r| r.starts_with("return:")) {
            if let Some(ref entry_number) = existing.journal_entry_number {
                if let Ok(Some(entry)) = self.journal_repo.find_by_number(entry_number).await {
                    let _ = self.journal_repo.delete(&entry.id).await;
                }
            }
        } else if let Ok(Some(entry)) = self.journal_repo.find_by_source_id(&pid.to_string()).await {
            let _ = self.journal_repo.delete(&entry.id).await;
        }

        // 3. Build updated payment
        let payment_type = parse_payment_type(&req.payment_type);
        let amount = Decimal::try_from(req.amount)
            .map_err(|_| AppError::Invalid("المبلغ غير صالح".into()))?;
        let exchange_rate = req.exchange_rate
            .and_then(|v| Decimal::try_from(v).ok())
            .unwrap_or(Decimal::ONE);
        let currency_code = req.currency_code.unwrap_or_default();
        let payment_date = DateTime::parse_from_rfc3339(&req.payment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let customer_id = req.customer_id.map(|id| {
            id.parse::<CustomerId>().map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))
        }).transpose()?;

        let supplier_id = req.supplier_id.map(|id| {
            id.parse::<SupplierId>().map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))
        }).transpose()?;

        let debit_account_id = req.debit_account_id
            .as_deref()
            .map(str::parse::<AccountId>)
            .transpose()
            .map_err(|_| AppError::Invalid("معرف حساب المدين غير صالح".into()))?;
        let credit_account_id = req.credit_account_id
            .as_deref()
            .map(str::parse::<AccountId>)
            .transpose()
            .map_err(|_| AppError::Invalid("معرف حساب الدائن غير صالح".into()))?;

        let mut updated_payment = Payment::new(
            existing.voucher_number.clone(),
            payment_type,
            amount,
            currency_code.clone(),
            exchange_rate,
            payment_date,
            debit_account_id,
            credit_account_id,
            customer_id,
            supplier_id,
            req.reference.or(existing.reference.clone()),
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        // Preserve original id and timestamps
        updated_payment.id = existing.id;
        updated_payment.created_at = existing.created_at;

        // 4. Build new journal lines
        let (amount_ma, currency) = build_monetary_amount(updated_payment.amount, &currency_code, exchange_rate);
        let zero_ma = MonetaryAmount::zero(currency);
        let cash_account = self.account_repo.find_by_code("122").await?
            .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود".into()))?;
        let journal_type = payment_type_to_journal_type(&updated_payment.payment_type);

        let journal_lines = build_journal_lines(
            &mut updated_payment,
            cash_account.id,
            amount_ma,
            zero_ma,
            &self.customer_repo,
            &self.supplier_repo,
            &self.account_repo,
        ).await?;

        if !journal_lines.is_empty() {
            let entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut entry = JournalEntry::new(
                entry_number.clone(),
                journal_type,
                journal_lines,
                updated_payment.payment_date,
                updated_payment.notes.clone().unwrap_or_else(|| "سند مالي".to_string()),
                Some(updated_payment.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
            updated_payment.journal_entry_number = Some(entry_number);
        } else {
            updated_payment.journal_entry_number = None;
        }

        self.repo.save(&updated_payment).await?;

        // 5. Apply new entity balances
        let (new_amount_ma, _) = build_monetary_amount(updated_payment.amount, &updated_payment.currency_code, updated_payment.exchange_rate);
        let new_base_amount = new_amount_ma.base_amount;

        if !is_return {
            apply_entity_balances(
                &updated_payment.payment_type,
                new_base_amount,
                &updated_payment.customer_id,
                &updated_payment.supplier_id,
                &updated_payment.debit_account_id,
                &self.customer_repo,
                &self.supplier_repo,
                &self.account_repo,
            ).await?;
        } else {
            apply_return_entity_balances(
                &updated_payment.payment_type,
                new_base_amount,
                &updated_payment.customer_id,
                &updated_payment.supplier_id,
                &self.customer_repo,
                &self.supplier_repo,
            ).await?;
        }

        Ok(enrich_payment(updated_payment, &self.customer_repo, &self.supplier_repo).await)
    }
}
