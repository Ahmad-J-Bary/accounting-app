use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{CustomerId, SupplierId};
use crate::ports::payment_repository::PaymentRepository;
use crate::dto::payment_dto::{CreatePaymentRequest, PaymentDto};
use crate::errors::AppError;

fn to_dto(p: Payment) -> PaymentDto {
    PaymentDto {
        id: p.id.to_string(),
        payment_type: format!("{:?}", p.payment_type),
        amount: p.amount.to_string(),
        payment_date: p.payment_date.to_rfc3339(),
        customer_id: p.customer_id.map(|c| c.to_string()),
        customer_name: None,
        supplier_id: p.supplier_id.map(|s| s.to_string()),
        supplier_name: None,
        reference: p.reference,
        notes: p.notes,
        created_at: p.created_at.to_rfc3339(),
    }
}

pub struct CreatePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
}

impl CreatePaymentUseCase {
    pub fn new(repo: Arc<dyn PaymentRepository>) -> Self {
        Self { repo }
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
            .map_err(|_| AppError::Invalid("Ø§Ù„Ù…Ø¨Ù„Øº ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;

        let payment_date = DateTime::parse_from_rfc3339(&req.payment_date)
            .map_err(|_| AppError::Invalid("Ø§Ù„ØªØ§Ø±ÙŠØ® ØºÙŠØ± ØµØ§Ù„Ø­".into()))?
            .with_timezone(&chrono::Utc);

        let customer_id = req.customer_id.map(|id| {
            id.parse::<CustomerId>().map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ø¹Ù…ÙŠÙ„ ØºÙŠØ± ØµØ§Ù„Ø­".into()))
        }).transpose()?;

        let supplier_id = req.supplier_id.map(|id| {
            id.parse::<SupplierId>().map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± ØµØ§Ù„Ø­".into()))
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
        Ok(to_dto(payment))
    }
}

pub struct ListPaymentsUseCase {
    repo: Arc<dyn PaymentRepository>,
}

impl ListPaymentsUseCase {
    pub fn new(repo: Arc<dyn PaymentRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, customer_id: Option<String>, supplier_id: Option<String>) -> Result<Vec<PaymentDto>, AppError> {
        let payments = if let Some(cid) = customer_id {
            let id = cid.parse::<CustomerId>().map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ø¹Ù…ÙŠÙ„ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
            self.repo.list_by_customer(&id).await?
        } else if let Some(sid) = supplier_id {
            let id = sid.parse::<SupplierId>().map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
            self.repo.list_by_supplier(&id).await?
        } else {
            self.repo.list_all().await?
        };
        Ok(payments.into_iter().map(to_dto).collect())
    }
}
