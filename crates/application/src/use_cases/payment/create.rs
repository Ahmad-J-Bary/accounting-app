use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::accounting::journal_entry::JournalEntry;
use domain::payments::Payment;
use domain::shared::ids::{CustomerId, SupplierId, AccountId};
use domain::shared::MonetaryAmount;
use crate::dto::payment_dto::{CreatePaymentRequest, PaymentDto};
use crate::errors::AppError;
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use super::helpers::{enrich_payment, apply_entity_balances, build_monetary_amount};
use super::journal_builder::{parse_payment_type, voucher_prefix, payment_type_to_journal_type, build_journal_lines};

pub struct CreatePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl CreatePaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo, journal_repo, account_repo }
    }

    pub async fn execute(&self, req: CreatePaymentRequest) -> Result<PaymentDto, AppError> {
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

        let voucher_number = req.voucher_number.unwrap_or_else(|| {
            let prefix = voucher_prefix(&payment_type);
            format!("{}-{}", prefix, chrono::Utc::now().timestamp())
        });

        let mut payment = Payment::new(
            voucher_number,
            payment_type,
            amount,
            currency_code.clone(),
            exchange_rate,
            payment_date,
            debit_account_id,
            credit_account_id,
            customer_id,
            supplier_id,
            req.reference,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        // --- Accounting Integration ---
        let (amount_ma, currency) = build_monetary_amount(payment.amount, &currency_code, exchange_rate);
        let base_amount = amount_ma.base_amount;
        let zero_ma = MonetaryAmount::zero(currency);

        let cash_account = self.account_repo.find_by_code("122").await?
            .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود".into()))?;

        let journal_type = payment_type_to_journal_type(&payment.payment_type);

        let journal_lines = build_journal_lines(
            &mut payment,
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
                payment.payment_date,
                payment.notes.clone().unwrap_or_else(|| "سند مالي".to_string()),
                Some(payment.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
            payment.journal_entry_number = Some(entry_number);
        }

        self.repo.save(&payment).await?;

        // --- Update entity balances ---
        apply_entity_balances(
            &payment.payment_type,
            base_amount,
            &payment.customer_id,
            &payment.supplier_id,
            &payment.debit_account_id,
            &self.customer_repo,
            &self.supplier_repo,
            &self.account_repo,
        ).await?;

        Ok(enrich_payment(payment, &self.customer_repo, &self.supplier_repo).await)
    }
}
