use super::invoice_line::InvoiceLine;
use crate::shared::errors::DomainError;
use crate::shared::ids::InvoiceId;
use crate::shared::money::Money;
use crate::shared::CustomerId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: InvoiceId,
    pub customer_id: CustomerId,
    pub lines: Vec<InvoiceLine>,
    pub issued_at: DateTime<Utc>,
    pub posted: bool,
}

impl Invoice {
    pub fn new(customer_id: CustomerId, lines: Vec<InvoiceLine>) -> Result<Self, DomainError> {
        if lines.is_empty() {
            return Err(DomainError::Invalid("الفاتورة يجب أن تحتوي على سطر واحد على الأقل".into()));
        }

        // Validate each line
        for line in &lines {
            if line.quantity <= Decimal::ZERO {
                return Err(DomainError::Invalid("الكمية يجب أن تكون أكبر من صفر".into()));
            }
            if line.unit_price.is_negative() {
                return Err(DomainError::Invalid("سعر الوحدة يجب أن يكون غير سالب".into()));
            }
        }

        Ok(Self {
            id: InvoiceId(Uuid::new_v4()),
            customer_id,
            lines,
            issued_at: Utc::now(),
            posted: false,
        })
    }

    pub fn total(&self) -> Money {
        self.lines.iter().fold(Money::zero(), |acc, line| {
            acc + line.line_total()
        })
    }

    pub fn post(&mut self) -> Result<(), DomainError> {
        if self.posted {
            return Err(DomainError::Invalid("الفاتورة مُرحّلة مسبقًا".into()));
        }
        
        if self.lines.is_empty() {
            return Err(DomainError::Invalid("لا يمكن ترحيل فاتورة فارغة".into()));
        }

        self.posted = true;
        Ok(())
    }

    pub fn is_posted(&self) -> bool {
        self.posted
    }

    pub fn add_line(&mut self, line: InvoiceLine) -> Result<(), DomainError> {
        if self.posted {
            return Err(DomainError::Forbidden("لا يمكن إضافة سطر لفاتورة مُرحّلة".into()));
        }
        
        if line.quantity <= Decimal::ZERO {
            return Err(DomainError::Invalid("الكمية يجب أن تكون أكبر من صفر".into()));
        }
        
        if line.unit_price.is_negative() {
            return Err(DomainError::Invalid("سعر الوحدة يجب أن يكون غير سالب".into()));
        }

        self.lines.push(line);
        Ok(())
    }

    pub fn remove_line(&mut self, index: usize) -> Result<(), DomainError> {
        if self.posted {
            return Err(DomainError::Forbidden("لا يمكن حذف سطر من فاتورة مُرحّلة".into()));
        }

        if index >= self.lines.len() {
            return Err(DomainError::Invalid("مؤشر السطر غير صالح".into()));
        }

        self.lines.remove(index);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn invoice_cannot_be_empty() {
        let result = Invoice::new(
            CustomerId(Uuid::new_v4()),
            vec![],
        );
        assert!(result.is_err());
    }

    #[test]
    fn invoice_with_valid_lines_succeeds() {
        let customer_id = CustomerId(Uuid::new_v4());
        let lines = vec![
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(2),
                Money::from(dec!(50)),
            ),
        ];

        let result = Invoice::new(customer_id, lines);
        assert!(result.is_ok());
    }

    #[test]
    fn invoice_total_calculates_correctly() {
        let customer_id = CustomerId(Uuid::new_v4());
        let lines = vec![
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(2),
                Money::from(dec!(50)),
            ),
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(3),
                Money::from(dec!(100)),
            ),
        ];

        let invoice = Invoice::new(customer_id, lines).unwrap();
        let total = invoice.total();
        assert_eq!(total.amount(), dec!(400));
    }

    #[test]
    fn posting_twice_is_rejected() {
        let customer_id = CustomerId(Uuid::new_v4());
        let lines = vec![
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(2),
                Money::from(dec!(50)),
            ),
        ];

        let mut invoice = Invoice::new(customer_id, lines).unwrap();
        assert!(invoice.post().is_ok());
        assert!(invoice.post().is_err());
    }

    #[test]
    fn cannot_add_line_to_posted_invoice() {
        let customer_id = CustomerId(Uuid::new_v4());
        let lines = vec![
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(2),
                Money::from(dec!(50)),
            ),
        ];

        let mut invoice = Invoice::new(customer_id, lines).unwrap();
        invoice.post().unwrap();

        let new_line = InvoiceLine::new(
            ProductId(Uuid::new_v4()),
            dec!(1),
            Money::from(dec!(30)),
        );

        assert!(invoice.add_line(new_line).is_err());
    }

    #[test]
    fn cannot_remove_line_from_posted_invoice() {
        let customer_id = CustomerId(Uuid::new_v4());
        let lines = vec![
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(2),
                Money::from(dec!(50)),
            ),
        ];

        let mut invoice = Invoice::new(customer_id, lines).unwrap();
        invoice.post().unwrap();

        assert!(invoice.remove_line(0).is_err());
    }

    #[test]
    fn negative_quantity_is_rejected() {
        let customer_id = CustomerId(Uuid::new_v4());
        let lines = vec![
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(-1),
                Money::from(dec!(50)),
            ),
        ];

        let result = Invoice::new(customer_id, lines);
        assert!(result.is_err());
    }

    #[test]
    fn negative_unit_price_is_rejected() {
        let customer_id = CustomerId(Uuid::new_v4());
        let lines = vec![
            InvoiceLine::new(
                ProductId(Uuid::new_v4()),
                dec!(2),
                Money::from(dec!(-50)),
            ),
        ];

        let result = Invoice::new(customer_id, lines);
        assert!(result.is_err());
    }
}
