use super::invoice_line::InvoiceLine;
use crate::shared::errors::DomainError;
use crate::shared::ids::InvoiceId;
#[cfg(test)]
use crate::shared::ids::MaterialId;
use crate::shared::money::Money;
use crate::shared::CustomerId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: InvoiceId,
    pub invoice_number: String,
    pub customer_id: CustomerId,
    pub lines: Vec<InvoiceLine>,
    pub tax_amount: Money,
    pub discount_amount: Money,
    pub issued_at: DateTime<Utc>,
    pub posted: bool,
}

impl Invoice {
    pub fn new(
        invoice_number: String,
        customer_id: CustomerId,
        lines: Vec<InvoiceLine>,
        tax_amount: Money,
        discount_amount: Money,
    ) -> Result<Self, DomainError> {
        if lines.is_empty() {
            return Err(DomainError::Invalid(
                "الفاتورة يجب أن تحتوي على سطر واحد على الأقل".into(),
            ));
        }

        for line in &lines {
            if line.quantity <= Decimal::ZERO {
                return Err(DomainError::Invalid(
                    "الكمية يجب أن تكون أكبر من صفر".into(),
                ));
            }
            if line.unit_price.is_negative() {
                return Err(DomainError::Invalid(
                    "سعر الوحدة يجب أن يكون غير سالب".into(),
                ));
            }
        }

        Ok(Self {
            id: InvoiceId(Uuid::new_v4()),
            invoice_number,
            customer_id,
            lines,
            tax_amount,
            discount_amount,
            issued_at: Utc::now(),
            posted: false,
        })
    }

    pub fn subtotal(&self) -> Money {
        let first_currency = self.lines[0].unit_price.currency().clone();
        self.lines
            .iter()
            .fold(Money::new(Decimal::ZERO, first_currency), |acc, line| {
                acc + line.line_total().original
            })
    }

    pub fn total(&self) -> Money {
        self.subtotal() + self.tax_amount.clone() - self.discount_amount.clone()
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
            return Err(DomainError::Forbidden(
                "لا يمكن إضافة سطر لفاتورة مُرحّلة".into(),
            ));
        }

        if line.quantity <= Decimal::ZERO {
            return Err(DomainError::Invalid(
                "الكمية يجب أن تكون أكبر من صفر".into(),
            ));
        }

        if line.unit_price.is_negative() {
            return Err(DomainError::Invalid(
                "سعر الوحدة يجب أن يكون غير سالب".into(),
            ));
        }

        self.lines.push(line);
        Ok(())
    }

    pub fn remove_line(&mut self, index: usize) -> Result<(), DomainError> {
        if self.posted {
            return Err(DomainError::Forbidden(
                "لا يمكن حذف سطر من فاتورة مُرحّلة".into(),
            ));
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
    use crate::shared::currency::Currency;
    use crate::shared::MonetaryAmount;
    use rust_decimal_macros::dec;

    fn test_base_currency() -> Currency {
        Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
    }

    fn test_zero_base() -> Money {
        Money::new(Decimal::ZERO, test_base_currency())
    }

    #[test]
    fn invoice_cannot_be_empty() {
        let result = Invoice::new(
            "INV-001".into(),
            CustomerId::new(),
            vec![],
            test_zero_base(),
            test_zero_base(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn invoice_with_valid_lines_succeeds() {
        let base_currency = test_base_currency();
        let customer_id = CustomerId::new();
        let lines = vec![InvoiceLine::new(
            None,
            MaterialId(Uuid::new_v4()),
            dec!(2),
            MonetaryAmount::from_base(dec!(50), base_currency.clone()),
            None, None, None, None, None, None, None, None, None, None, None, None, None
        )];

        let result = Invoice::new(
            "INV-001".into(),
            customer_id,
            lines,
            test_zero_base(),
            test_zero_base(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn invoice_total_calculates_correctly() {
        let base_currency = test_base_currency();
        let customer_id = CustomerId::new();
        let lines = vec![
            InvoiceLine::new(
                None,
                MaterialId(Uuid::new_v4()),
                dec!(2),
                MonetaryAmount::from_base(dec!(50), base_currency.clone()),
                None, None, None, None, None, None, None, None, None, None, None, None, None
            ),
            InvoiceLine::new(
                None,
                MaterialId(Uuid::new_v4()),
                dec!(3),
                MonetaryAmount::from_base(dec!(100), base_currency.clone()),
                None, None, None, None, None, None, None, None, None, None, None, None, None
            ),
        ];

        let invoice = Invoice::new(
            "INV-001".into(),
            customer_id,
            lines,
            test_zero_base(),
            test_zero_base(),
        )
        .unwrap();
        let total = invoice.total();
        assert_eq!(total.amount(), dec!(400));
    }

    #[test]
    fn posting_twice_is_rejected() {
        let base_currency = test_base_currency();
        let customer_id = CustomerId::new();
        let lines = vec![InvoiceLine::new(
            None,
            MaterialId(Uuid::new_v4()),
            dec!(2),
            MonetaryAmount::from_base(dec!(50), base_currency.clone()),
            None, None, None, None, None, None, None, None, None, None, None, None, None
        )];

        let mut invoice = Invoice::new(
            "INV-001".into(),
            customer_id,
            lines,
            test_zero_base(),
            test_zero_base(),
        )
        .unwrap();
        assert!(invoice.post().is_ok());
        assert!(invoice.post().is_err());
    }

    #[test]
    fn cannot_add_line_to_posted_invoice() {
        let base_currency = test_base_currency();
        let customer_id = CustomerId::new();
        let lines = vec![InvoiceLine::new(
            None,
            MaterialId(Uuid::new_v4()),
            dec!(2),
            MonetaryAmount::from_base(dec!(50), base_currency.clone()),
            None, None, None, None, None, None, None, None, None, None, None, None, None
        )];

        let mut invoice = Invoice::new(
            "INV-001".into(),
            customer_id,
            lines,
            test_zero_base(),
            test_zero_base(),
        )
        .unwrap();
        invoice.post().unwrap();

        let new_line = InvoiceLine::new(
            None,
            MaterialId(Uuid::new_v4()),
            dec!(1),
            MonetaryAmount::from_base(dec!(30), base_currency.clone()),
            None, None, None, None, None, None, None, None, None, None, None, None, None
        );

        assert!(invoice.add_line(new_line).is_err());
    }

    #[test]
    fn cannot_remove_line_from_posted_invoice() {
        let base_currency = test_base_currency();
        let customer_id = CustomerId::new();
        let lines = vec![InvoiceLine::new(
            None,
            MaterialId(Uuid::new_v4()),
            dec!(2),
            MonetaryAmount::from_base(dec!(50), base_currency.clone()),
            None, None, None, None, None, None, None, None, None, None, None, None, None
        )];

        let mut invoice = Invoice::new(
            "INV-001".into(),
            customer_id,
            lines,
            test_zero_base(),
            test_zero_base(),
        )
        .unwrap();
        invoice.post().unwrap();

        assert!(invoice.remove_line(0).is_err());
    }

    #[test]
    fn negative_quantity_is_rejected() {
        let base_currency = test_base_currency();
        let customer_id = CustomerId::new();
        let lines = vec![InvoiceLine::new(
            None,
            MaterialId(Uuid::new_v4()),
            dec!(-1),
            MonetaryAmount::from_base(dec!(50), base_currency.clone()),
            None, None, None, None, None, None, None, None, None, None, None, None, None
        )];

        let result = Invoice::new(
            "INV-001".into(),
            customer_id,
            lines,
            test_zero_base(),
            test_zero_base(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn negative_unit_price_is_rejected() {
        let base_currency = test_base_currency();
        let customer_id = CustomerId::new();
        let lines = vec![InvoiceLine::new(
            None,
            MaterialId(Uuid::new_v4()),
            dec!(2),
            MonetaryAmount::from_base(dec!(-50), base_currency.clone()),
            None, None, None, None, None, None, None, None, None, None, None, None, None
        )];

        let result = Invoice::new(
            "INV-001".into(),
            customer_id,
            lines,
            test_zero_base(),
            test_zero_base(),
        );
        assert!(result.is_err());
    }
}
