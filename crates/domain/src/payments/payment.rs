use crate::shared::errors::DomainError;
use crate::shared::ids::{PaymentId, CustomerId, SupplierId, AccountId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentType {
    Receipt,           // قبض من عميل
    SupplierPayment,   // دفع لمورد
    CustomerPayment,   // دفع لعميل (auto-generated for sales return cash refund)
    SupplierReceipt,   // قبض من مورد (auto-generated for purchase return cash receipt)
    ExpenseVoucher,    // سند مصاريف
    DrawingsVoucher,   // سند مسحوبات
    CashIn,            // إيداع
    CashOut,           // سحب
    Other,             // أخرى
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: PaymentId,
    pub voucher_number: String,
    pub payment_type: PaymentType,
    pub amount: Decimal,
    pub currency_code: String,
    pub exchange_rate: Decimal,
    pub payment_date: DateTime<Utc>,
    pub debit_account_id: Option<AccountId>,
    pub credit_account_id: Option<AccountId>,
    pub journal_entry_number: Option<String>,
    pub customer_id: Option<CustomerId>,
    pub supplier_id: Option<SupplierId>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub invoice_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Payment {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        voucher_number: String,
        payment_type: PaymentType,
        amount: Decimal,
        currency_code: String,
        exchange_rate: Decimal,
        payment_date: DateTime<Utc>,
        debit_account_id: Option<AccountId>,
        credit_account_id: Option<AccountId>,
        customer_id: Option<CustomerId>,
        supplier_id: Option<SupplierId>,
        reference: Option<String>,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        Self::with_invoice_id(
            voucher_number, payment_type, amount, currency_code, exchange_rate,
            payment_date, debit_account_id, credit_account_id, customer_id,
            supplier_id, reference, notes, None,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn with_invoice_id(
        voucher_number: String,
        payment_type: PaymentType,
        amount: Decimal,
        currency_code: String,
        exchange_rate: Decimal,
        payment_date: DateTime<Utc>,
        debit_account_id: Option<AccountId>,
        credit_account_id: Option<AccountId>,
        customer_id: Option<CustomerId>,
        supplier_id: Option<SupplierId>,
        reference: Option<String>,
        notes: Option<String>,
        invoice_id: Option<String>,
    ) -> Result<Self, DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدفعة يجب أن يكون موجبًا".into()));
        }
        if voucher_number.trim().is_empty() {
            return Err(DomainError::Invalid("رقم السند لا يمكن أن يكون فارغًا".into()));
        }
        if currency_code.trim().is_empty() {
            return Err(DomainError::Invalid("عملة السند مطلوبة".into()));
        }
        if exchange_rate <= Decimal::ZERO {
            return Err(DomainError::Invalid("سعر الصرف يجب أن يكون موجبًا".into()));
        }

        // Allow any payment type to be linked to customer or supplier.
        // Receipt (قبض) can come from a supplier (قبض من مورد), and
        // SupplierPayment (دفع) can go to a customer (دفع لعميل).
        // This enables auto-generated return settlement vouchers to work correctly.
        // The use case layer enforces business rules per payment type.

        let now = Utc::now();
        Ok(Self {
            id: PaymentId(Uuid::new_v4()),
            voucher_number,
            payment_type,
            amount,
            currency_code,
            exchange_rate,
            payment_date,
            debit_account_id,
            credit_account_id,
            journal_entry_number: None,
            customer_id,
            supplier_id,
            reference,
            notes,
            invoice_id,
            created_at: now,
            updated_at: now,
        })
    }
}
