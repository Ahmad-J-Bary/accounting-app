use crate::shared::money::Money;
use crate::shared::ProductId;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLine {
    pub product_id: ProductId,
    pub quantity: Decimal,
    pub unit_price: Money,
}

impl InvoiceLine {
    pub fn new(product_id: ProductId, quantity: Decimal, unit_price: Money) -> Self {
        Self {
            product_id,
            quantity,
            unit_price,
        }
    }

    pub fn line_total(&self) -> Money {
        self.unit_price.clone() * self.quantity
    }
}
