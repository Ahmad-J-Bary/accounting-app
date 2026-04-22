use crate::shared::errors::DomainError;
use crate::shared::ids::ProductId;
use crate::shared::money::Money;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: ProductId,
    pub name: String,
    pub code: String,
    pub unit_price: Money,
    pub cost_price: Money,
    pub stock_quantity: Decimal,
    pub minimum_stock: Decimal,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Product {
    pub fn new(
        name: String,
        code: String,
        unit_price: Money,
        cost_price: Money,
        initial_stock: Decimal,
        minimum_stock: Decimal,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم المنتج لا يمكن أن يكون فارغًا".into()));
        }

        if code.trim().is_empty() {
            return Err(DomainError::Invalid("كود المنتج لا يمكن أن يكون فارغًا".into()));
        }

        if unit_price.is_negative() {
            return Err(DomainError::Invalid("سعر البيع يجب أن يكون غير سالب".into()));
        }

        if cost_price.is_negative() {
            return Err(DomainError::Invalid("سعر التكلفة يجب أن يكون غير سالب".into()));
        }

        if initial_stock < Decimal::ZERO {
            return Err(DomainError::Invalid("الكمية الأولية يجب أن تكون غير سالبة".into()));
        }

        if minimum_stock < Decimal::ZERO {
            return Err(DomainError::Invalid("الحد الأدنى للمخزون يجب أن يكون غير سالب".into()));
        }

        let now = Utc::now();

        Ok(Self {
            id: ProductId(Uuid::new_v4()),
            name,
            code,
            unit_price,
            cost_price,
            stock_quantity: initial_stock,
            minimum_stock,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn adjust_stock(&mut self, quantity: Decimal) -> Result<(), DomainError> {
        let new_quantity = self.stock_quantity + quantity;

        if new_quantity < Decimal::ZERO {
            return Err(DomainError::Invalid("الكمية الناتجة ستكون سالبة".into()));
        }

        self.stock_quantity = new_quantity;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn is_below_minimum_stock(&self) -> bool {
        self.stock_quantity <= self.minimum_stock
    }

    pub fn is_in_stock(&self) -> bool {
        self.stock_quantity > Decimal::ZERO
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }

    pub fn update_prices(&mut self, unit_price: Money, cost_price: Money) -> Result<(), DomainError> {
        if unit_price.is_negative() {
            return Err(DomainError::Invalid("سعر البيع يجب أن يكون غير سالب".into()));
        }

        if cost_price.is_negative() {
            return Err(DomainError::Invalid("سعر التكلفة يجب أن يكون غير سالب".into()));
        }

        self.unit_price = unit_price;
        self.cost_price = cost_price;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn profit_margin(&self) -> Decimal {
        if self.unit_price.amount() == Decimal::ZERO {
            return Decimal::ZERO;
        }
        (self.unit_price.amount() - self.cost_price.amount()) / self.unit_price.amount()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn product_creation_with_valid_data_succeeds() {
        let result = Product::new(
            "منتج تجريبي".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(70)),
            dec!(50),
            dec!(10),
        );

        assert!(result.is_ok());
        let product = result.unwrap();
        assert_eq!(product.name, "منتج تجريبي");
        assert_eq!(product.code, "PROD-001");
        assert_eq!(product.stock_quantity, dec!(50));
    }

    #[test]
    fn product_name_cannot_be_empty() {
        let result = Product::new(
            "".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(70)),
            dec!(50),
            dec!(10),
        );

        assert!(result.is_err());
    }

    #[test]
    fn product_code_cannot_be_empty() {
        let result = Product::new(
            "منتج تجريبي".to_string(),
            "".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(70)),
            dec!(50),
            dec!(10),
        );

        assert!(result.is_err());
    }

    #[test]
    fn negative_unit_price_is_rejected() {
        let result = Product::new(
            "منتج تجريبي".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(-100)),
            Money::syp(dec!(70)),
            dec!(50),
            dec!(10),
        );

        assert!(result.is_err());
    }

    #[test]
    fn negative_cost_price_is_rejected() {
        let result = Product::new(
            "منتج تجريبي".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(-70)),
            dec!(50),
            dec!(10),
        );

        assert!(result.is_err());
    }

    #[test]
    fn adjust_stock_updates_quantity() {
        let mut product = Product::new(
            "منتج تجريبي".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(70)),
            dec!(50),
            dec!(10),
        ).unwrap();

        product.adjust_stock(dec!(10)).unwrap();
        assert_eq!(product.stock_quantity, dec!(60));
    }

    #[test]
    fn adjust_stock_below_zero_is_rejected() {
        let mut product = Product::new(
            "منتج تجريبي".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(70)),
            dec!(10),
            dec!(5),
        ).unwrap();

        let result = product.adjust_stock(dec!(-20));
        assert!(result.is_err());
    }

    #[test]
    fn is_below_minimum_stock_returns_true_when_below() {
        let product = Product::new(
            "منتج تجريبي".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(70)),
            dec!(5),
            dec!(10),
        ).unwrap();

        assert!(product.is_below_minimum_stock());
    }

    #[test]
    fn profit_margin_calculates_correctly() {
        let product = Product::new(
            "منتج تجريبي".to_string(),
            "PROD-001".to_string(),
            Money::syp(dec!(100)),
            Money::syp(dec!(70)),
            dec!(50),
            dec!(10),
        ).unwrap();

        let margin = product.profit_margin();
        assert_eq!(margin, dec!(0.30));
    }
}
