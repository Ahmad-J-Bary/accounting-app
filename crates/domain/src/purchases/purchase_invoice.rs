use crate::shared::errors::DomainError;
use crate::shared::ids::{PurchaseInvoiceId, SupplierId, MaterialId, AccountId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PurchaseInvoiceStatus {
    Draft,
    Posted,
    Cancelled,
    Paid,
    PartiallyPaid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseInvoiceItem {
    pub id: String,
    pub material_id: MaterialId,
    pub quantity: Decimal,
    pub unit_price: Decimal,
    pub line_total: Decimal,
    pub notes: Option<String>,
}

impl PurchaseInvoiceItem {
    pub fn new(
        material_id: MaterialId,
        quantity: Decimal,
        unit_price: Decimal,
    ) -> Result<Self, DomainError> {
        if quantity <= Decimal::ZERO {
            return Err(DomainError::Invalid("الكمية يجب أن تكون موجبة".into()));
        }
        if unit_price < Decimal::ZERO {
            return Err(DomainError::Invalid("سعر الوحدة يجب أن يكون غير سالب".into()));
        }
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            material_id,
            quantity,
            unit_price,
            line_total: quantity * unit_price,
            notes: None,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseAdditionalCost {
    pub id: String,
    pub description: String,
    pub account_id: AccountId,
    pub amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseInvoice {
    pub id: PurchaseInvoiceId,
    pub invoice_number: String,
    pub supplier_id: SupplierId,
    pub items: Vec<PurchaseInvoiceItem>,
    pub additional_costs: Vec<PurchaseAdditionalCost>,
    pub subtotal: Decimal,
    pub tax_amount: Decimal,
    pub discount_amount: Decimal,
    pub total: Decimal,
    pub amount_paid: Decimal,
    pub status: PurchaseInvoiceStatus,
    pub invoice_date: DateTime<Utc>,
    pub due_date: Option<DateTime<Utc>>,
    pub currency_code: String,
    pub exchange_rate: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PurchaseInvoice {
    pub fn new(
        invoice_number: String,
        supplier_id: SupplierId,
        invoice_date: DateTime<Utc>,
        due_date: Option<DateTime<Utc>>,
        currency_code: String,
        exchange_rate: Decimal,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if invoice_number.trim().is_empty() {
            return Err(DomainError::Invalid("رقم الفاتورة لا يمكن أن يكون فارغًا".into()));
        }
        let now = Utc::now();
        Ok(Self {
            id: PurchaseInvoiceId(Uuid::new_v4()),
            invoice_number,
            supplier_id,
            items: vec![],
            additional_costs: vec![],
            subtotal: Decimal::ZERO,
            tax_amount: Decimal::ZERO,
            discount_amount: Decimal::ZERO,
            total: Decimal::ZERO,
            amount_paid: Decimal::ZERO,
            status: PurchaseInvoiceStatus::Draft,
            invoice_date,
            due_date,
            currency_code,
            exchange_rate,
            notes,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn add_item(&mut self, item: PurchaseInvoiceItem) -> Result<(), DomainError> {
        if self.status == PurchaseInvoiceStatus::Posted {
            return Err(DomainError::Forbidden("لا يمكن تعديل فاتورة مرحّلة".into()));
        }
        self.items.push(item);
        self.recalculate_totals();
        Ok(())
    }

    pub fn add_additional_cost(&mut self, cost: PurchaseAdditionalCost) -> Result<(), DomainError> {
        if self.status == PurchaseInvoiceStatus::Posted {
            return Err(DomainError::Forbidden("لا يمكن تعديل فاتورة مرحّلة".into()));
        }
        self.additional_costs.push(cost);
        self.recalculate_totals();
        Ok(())
    }

    pub fn recalculate_totals(&mut self) {
        self.subtotal = self.items.iter().map(|i| i.line_total).sum();
        let costs: Decimal = self.additional_costs.iter().map(|c| c.amount).sum();
        self.total = self.subtotal + self.tax_amount + costs - self.discount_amount;
        self.updated_at = Utc::now();
    }

    pub fn set_tax(&mut self, tax_amount: Decimal) -> Result<(), DomainError> {
        if tax_amount < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الضريبة لا يمكن أن يكون سالبًا".into()));
        }
        self.tax_amount = tax_amount;
        self.recalculate_totals();
        Ok(())
    }

    pub fn set_discount(&mut self, discount_amount: Decimal) -> Result<(), DomainError> {
        if discount_amount < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الخصم لا يمكن أن يكون سالبًا".into()));
        }
        self.discount_amount = discount_amount;
        self.recalculate_totals();
        Ok(())
    }

    pub fn post(&mut self) -> Result<(), DomainError> {
        if self.status == PurchaseInvoiceStatus::Posted {
            return Err(DomainError::Invalid("الفاتورة مرحّلة مسبقًا".into()));
        }
        if self.status == PurchaseInvoiceStatus::Cancelled {
            return Err(DomainError::Invalid("الفاتورة ملغية".into()));
        }
        if self.items.is_empty() {
            return Err(DomainError::Invalid("لا يمكن ترحيل فاتورة فارغة".into()));
        }
        self.status = PurchaseInvoiceStatus::Posted;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<(), DomainError> {
        if self.status == PurchaseInvoiceStatus::Posted {
            return Err(DomainError::Forbidden("لا يمكن إلغاء فاتورة مرحّلة".into()));
        }
        self.status = PurchaseInvoiceStatus::Cancelled;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn apply_payment(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدفع يجب أن يكون موجبًا".into()));
        }
        self.amount_paid += amount;
        if self.amount_paid >= self.total {
            self.status = PurchaseInvoiceStatus::Paid;
        } else {
            self.status = PurchaseInvoiceStatus::PartiallyPaid;
        }
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn remaining_amount(&self) -> Decimal {
        (self.total - self.amount_paid).max(Decimal::ZERO)
    }
}
