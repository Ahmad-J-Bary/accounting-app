use super::helpers::{build_monetary_amount, compute_apply_balances, enrich_payment};
use super::journal_builder::{
    build_journal_lines, parse_payment_type, payment_type_to_journal_type, voucher_prefix,
};
use crate::dto::payment_dto::{CreatePaymentRequest, PaymentDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::use_cases::shared::fiscal_lifecycle::FiscalLifecyclePolicy;
use chrono::DateTime;
use domain::accounting::journal_entry::JournalEntry;
use domain::payments::Payment;
use domain::shared::ids::{AccountId, CustomerId, SupplierId};
use domain::shared::MonetaryAmount;
use rust_decimal::Decimal;
use std::sync::Arc;

pub struct CreatePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    fiscal_year_repo: Arc<dyn FiscalYearRepository>,
    fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl CreatePaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        fiscal_year_repo: Arc<dyn FiscalYearRepository>,
        fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
    ) -> Self {
        Self {
            repo,
            customer_repo,
            supplier_repo,
            journal_repo,
            account_repo,
            fiscal_year_repo,
            fiscal_period_repo,
        }
    }

    pub async fn execute(&self, req: CreatePaymentRequest) -> Result<PaymentDto, AppError> {
        let payment_type = parse_payment_type(&req.payment_type);

        let amount = Decimal::try_from(req.amount)
            .map_err(|_| AppError::Invalid("المبلغ غير صالح".into()))?;
        let exchange_rate = req
            .exchange_rate
            .and_then(|v| Decimal::try_from(v).ok())
            .unwrap_or(Decimal::ONE);
        let currency_code = req.currency_code.unwrap_or_default();

        let payment_date = DateTime::parse_from_rfc3339(&req.payment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        FiscalLifecyclePolicy::new(self.fiscal_year_repo.clone(), self.fiscal_period_repo.clone())
            .validate_normal_operational(None, payment_date)
            .await?;

        let customer_id = req
            .customer_id
            .map(|id| {
                id.parse::<CustomerId>()
                    .map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))
            })
            .transpose()?;

        let supplier_id = req
            .supplier_id
            .map(|id| {
                id.parse::<SupplierId>()
                    .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))
            })
            .transpose()?;

        let debit_account_id = req
            .debit_account_id
            .as_deref()
            .map(str::parse::<AccountId>)
            .transpose()
            .map_err(|_| AppError::Invalid("معرف حساب المدين غير صالح".into()))?;
        let credit_account_id = req
            .credit_account_id
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
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        // --- Accounting Integration ---
        let (amount_ma, currency) =
            build_monetary_amount(payment.amount, &currency_code, exchange_rate);
        let base_amount = amount_ma.base_amount;
        let zero_ma = MonetaryAmount::zero(currency);

        let cash_account = self
            .account_repo
            .find_by_code("122")
            .await?
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
        )
        .await?;

        let mut entry = None;
        if !journal_lines.is_empty() {
            let entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut built = JournalEntry::new(
                entry_number.clone(),
                journal_type,
                journal_lines,
                payment.payment_date,
                payment
                    .notes
                    .clone()
                    .unwrap_or_else(|| "سند مالي".to_string()),
                Some(payment.id.to_string()),
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;

            built.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            payment.journal_entry_number = Some(entry_number);
            entry = Some(built);
        }

        // --- Compute entity balance changes (not persisted yet) ---
        let balances = compute_apply_balances(
            &payment.payment_type,
            base_amount,
            &payment.customer_id,
            &payment.supplier_id,
            &payment.debit_account_id,
            &self.customer_repo,
            &self.supplier_repo,
            &self.account_repo,
        )
        .await?;

        // --- Commit journal + payment + balance changes in ONE transaction ---
        self.repo
            .save_with_accounting(
                &payment,
                entry.as_ref(),
                &[],
                &balances.customers,
                &balances.suppliers,
                &balances.accounts,
            )
            .await?;

        Ok(enrich_payment(payment, &self.customer_repo, &self.supplier_repo).await)
    }
}
