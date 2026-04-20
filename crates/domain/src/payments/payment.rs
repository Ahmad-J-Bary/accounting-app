use crate::shared::errors::DomainError;
use crate::shared::ids::{PaymentId, CustomerId, SupplierId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentType {
    Receipt,           // قبض من عميل
    SupplierPayment,   // دفع لمورد
    CashIn,            // إيداع
    CashOut,           // سحب
    Other,             // أخرى
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: PaymentId,
    pub payment_type: PaymentType,
    pub amount: Decimal,
    pub payment_date: DateTime<Utc>,
    pub customer_id: Option<CustomerId>,
    pub supplier_id: Option<SupplierId>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Payment {
    pub fn new(
        payment_type: PaymentType,
        amount: Decimal,
        payment_date: DateTime<Utc>,
        customer_id: Option<CustomerId>,
        supplier_id: Option<SupplierId>,
        reference: Option<String>,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدفعة يجب أن يكون موجبًا".into()));
        }

        // Validate that Receipt is linked to a customer
        if payment_type == PaymentType::Receipt && customer_id.is_none() {
            return Err(DomainError::Invalid(
                "قبض الأموال يجب أن يكون مرتبطًا بعميل".into(),
            ));
        }

        // Validate that SupplierPayment is linked to a supplier
        if payment_type == PaymentType::SupplierPayment && supplier_id.is_none() {
            return Err(DomainError::Invalid(
                "الدفع للمورد يجب أن يكون مرتبطًا بمورد".into(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: PaymentId(Uuid::new_v4()),
            payment_type,
            amount,
            payment_date,
            customer_id,
            supplier_id,
            reference,
            notes,
            created_at: now,
            updated_at: now,
        })
    }
}
