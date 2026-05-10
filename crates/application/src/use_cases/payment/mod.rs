use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{CustomerId, SupplierId};
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, Money, MonetaryAmount};
use crate::dto::payment_dto::{CreatePaymentRequest, PaymentDto};
use crate::errors::AppError;

async fn enrich_payment(
    p: Payment, 
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>
) -> PaymentDto {
    let mut customer_name = None;
    if let Some(cid) = &p.customer_id {
        if let Ok(Some(customer)) = customer_repo.find_by_id(cid).await {
            customer_name = Some(customer.name.clone());
        }
    }

    let mut supplier_name = None;
    if let Some(sid) = &p.supplier_id {
        if let Ok(Some(supplier)) = supplier_repo.find_by_id(sid).await {
            supplier_name = Some(supplier.name.clone());
        }
    }

    PaymentDto {
        id: p.id.to_string(),
        payment_type: format!("{:?}", p.payment_type),
        amount: p.amount.to_string(),
        payment_date: p.payment_date.to_rfc3339(),
        customer_id: p.customer_id.map(|c| c.to_string()),
        customer_name,
        supplier_id: p.supplier_id.map(|s| s.to_string()),
        supplier_name,
        reference: p.reference,
        notes: p.notes,
        created_at: p.created_at.to_rfc3339(),
    }
}

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
        let payment_type = match req.payment_type.as_str() {
            "Receipt" => PaymentType::Receipt,
            "SupplierPayment" => PaymentType::SupplierPayment,
            "CashIn" => PaymentType::CashIn,
            "CashOut" => PaymentType::CashOut,
            _ => PaymentType::Other,
        };

        let amount = Decimal::try_from(req.amount)
            .map_err(|_| AppError::Invalid("المبلغ غير صالح".into()))?;

        let payment_date = DateTime::parse_from_rfc3339(&req.payment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let customer_id = req.customer_id.map(|id| {
            id.parse::<CustomerId>().map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))
        }).transpose()?;

        let supplier_id = req.supplier_id.map(|id| {
            id.parse::<SupplierId>().map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))
        }).transpose()?;

        let payment = Payment::new(
            payment_type,
            amount,
            payment_date,
            customer_id,
            supplier_id,
            req.reference,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&payment).await?;

        // --- Accounting Integration ---
        let mut journal_lines = Vec::new();
        let currency = Currency::syp(); // SYP is now base
        let amount_ma = MonetaryAmount::new(Money::new(payment.amount, currency.clone()), Decimal::ONE);
        let zero_ma = MonetaryAmount::zero(currency.clone());

        let cash_account = self.account_repo.find_by_code("122").await?
            .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود".into()))?;

        let journal_type = match payment.payment_type {
            PaymentType::Receipt => JournalType::CashReceipt,
            PaymentType::SupplierPayment => JournalType::CashPayment,
            _ => JournalType::CashJournal,
        };

        match payment.payment_type {
            PaymentType::Receipt => {
                if let Some(cid) = &payment.customer_id {
                    let customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    
                    let p_acc_id = customer.account_id
                        .ok_or_else(|| AppError::Invalid("العميل لا يملك حساباً محاسبياً".into()))?;

                    // Debit Cash, Credit Customer
                    journal_lines.push(JournalLine::new(cash_account.id, amount_ma.clone(), zero_ma.clone(), format!("قبض من العميل: {}", customer.name)));
                    journal_lines.push(JournalLine::new(p_acc_id, zero_ma, amount_ma, format!("دفعة من العميل: {}", customer.name)));
                }
            },
            PaymentType::SupplierPayment => {
                if let Some(sid) = &payment.supplier_id {
                    let supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    
                    let p_acc_id = supplier.account_id
                        .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;

                    // Debit Supplier, Credit Cash
                    journal_lines.push(JournalLine::new(p_acc_id, amount_ma.clone(), zero_ma.clone(), format!("دفع للمورد: {}", supplier.name)));
                    journal_lines.push(JournalLine::new(cash_account.id, zero_ma, amount_ma, format!("دفعة للمورد: {}", supplier.name)));
                }
            },
            _ => {}
        }

        if !journal_lines.is_empty() {
            let mut entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                journal_type,
                journal_lines,
                payment.payment_date,
                payment.notes.clone().unwrap_or_else(|| "سند مالي".to_string()),
                Some(payment.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        Ok(enrich_payment(payment, &self.customer_repo, &self.supplier_repo).await)
    }
}

pub struct ListPaymentsUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
}

impl ListPaymentsUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo }
    }

    pub async fn execute(&self, customer_id: Option<String>, supplier_id: Option<String>) -> Result<Vec<PaymentDto>, AppError> {
        let payments = if let Some(cid) = customer_id {
            let id = cid.parse::<CustomerId>().map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;
            self.repo.list_by_customer(&id).await?
        } else if let Some(sid) = supplier_id {
            let id = sid.parse::<SupplierId>().map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;
            self.repo.list_by_supplier(&id).await?
        } else {
            self.repo.list_all().await?
        };

        let mut dtos = Vec::new();
        for p in payments {
            dtos.push(enrich_payment(p, &self.customer_repo, &self.supplier_repo).await);
        }
        Ok(dtos)
    }
}
