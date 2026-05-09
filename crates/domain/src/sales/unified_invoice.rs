#![allow(clippy::too_many_arguments)]
use super::invoice_line::InvoiceLine;
use crate::shared::currency::Currency;
use crate::shared::errors::DomainError;
use crate::shared::ids::{CustomerId, InvoiceId, SupplierId};
use crate::shared::monetary_amount::MonetaryAmount;
use crate::shared::money::Money;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InvoiceType {
    Sales,
    Purchase,
    PurchaseCosts, // تكاليف إضافية للمشتريات
    OpeningBalance,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InvoiceStatus {
    Draft,
    Posted,
    Cancelled,
    Reversed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentMethod {
    Cash,     // نقدي
    Deferred, // آجل
    Partial,  // دفع جزئي
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedInvoice {
    pub id: InvoiceId,
    pub invoice_number: String,
    pub invoice_type: InvoiceType,
    pub customer_id: Option<CustomerId>, // For Sales
    pub customer_name: Option<String>,
    pub supplier_id: Option<SupplierId>, // For Purchase
    pub supplier_name: Option<String>,
    pub lines: Vec<InvoiceLine>,
    pub tax_amount: MonetaryAmount,
    pub discount_amount: MonetaryAmount,
    pub total_amount: MonetaryAmount,
    pub payment_method: PaymentMethod,
    pub amount_paid: MonetaryAmount,
    pub status: InvoiceStatus,
    pub issued_at: DateTime<Utc>,
    pub currency_code: String,
    pub exchange_rate: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl UnifiedInvoice {
    pub fn new(
        invoice_number: String,
        invoice_type: InvoiceType,
        customer_id: Option<CustomerId>,
        customer_name: Option<String>,
        supplier_id: Option<SupplierId>,
        supplier_name: Option<String>,
        payment_method: PaymentMethod,
        amount_paid: Money,
        currency_code: String,
        exchange_rate: Decimal,
        issued_at: DateTime<Utc>,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if invoice_number.trim().is_empty() {
            return Err(DomainError::Invalid(
                "رقم الفاتورة لا يمكن أن يكون فارغًا".into(),
            ));
        }

        let now = Utc::now();
        let _base_currency = Currency::from_code("USD"); // System reference
        let doc_currency = Currency::from_code(&currency_code);

        Ok(Self {
            id: InvoiceId(Uuid::new_v4()),
            invoice_number,
            invoice_type,
            customer_id,
            customer_name,
            supplier_id,
            supplier_name,
            lines: vec![],
            tax_amount: MonetaryAmount::zero(doc_currency.clone()),
            discount_amount: MonetaryAmount::zero(doc_currency.clone()),
            total_amount: MonetaryAmount::zero(doc_currency.clone()),
            payment_method,
            amount_paid: MonetaryAmount::new(amount_paid, exchange_rate),
            status: InvoiceStatus::Draft,
            currency_code,
            exchange_rate,
            issued_at,
            notes,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn add_line(&mut self, line: InvoiceLine) -> Result<(), DomainError> {
        self.lines.push(line);
        self.recalculate_totals();
        Ok(())
    }

    pub fn remove_line(&mut self, index: usize) -> Result<(), DomainError> {
        if index >= self.lines.len() {
            return Err(DomainError::Invalid("مؤشر السطر غير صالح".into()));
        }
        self.lines.remove(index);
        self.recalculate_totals();
        Ok(())
    }

    pub fn recalculate_totals(&mut self) {
        let doc_currency = Currency::from_code(&self.currency_code);

        let subtotal =
            self.lines
                .iter()
                .fold(MonetaryAmount::zero(doc_currency.clone()), |acc, line| {
                    (acc + line.line_total())
                        .unwrap_or_else(|_| MonetaryAmount::zero(doc_currency.clone()))
                });

        // Convert to MonetaryAmount using the invoice's exchange rate
        self.total_amount =
            ((subtotal + self.tax_amount.clone()).unwrap() - self.discount_amount.clone()).unwrap();

        if self.payment_method == PaymentMethod::Cash {
            self.amount_paid = self.total_amount.clone();
        } else if self.payment_method == PaymentMethod::Deferred {
            self.amount_paid = MonetaryAmount::zero(doc_currency);
        }

        self.updated_at = Utc::now();
    }

    pub fn post(&mut self) -> Result<(), DomainError> {
        if self.status != InvoiceStatus::Draft {
            return Err(DomainError::Invalid("الفاتورة ليست في حالة مسودة".into()));
        }
        if self.lines.is_empty() {
            return Err(DomainError::Invalid("لا يمكن ترحيل فاتورة فارغة".into()));
        }
        self.status = InvoiceStatus::Posted;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<(), DomainError> {
        if self.status == InvoiceStatus::Posted {
            return Err(DomainError::Forbidden(
                "لا يمكن إلغاء فاتورة مرحّلة، استخدم العكس بدلاً من ذلك".into(),
            ));
        }
        self.status = InvoiceStatus::Cancelled;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn reopen(&mut self) -> Result<(), DomainError> {
        if self.status != InvoiceStatus::Posted {
            return Err(DomainError::Invalid(
                "يمكن فقط إعادة فتح الفواتير المرحلة".into(),
            ));
        }
        self.status = InvoiceStatus::Draft;
        self.updated_at = Utc::now();
        Ok(())
    }
}
