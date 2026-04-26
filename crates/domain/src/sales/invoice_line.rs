use crate::shared::money::Money;
use crate::shared::MaterialId;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLine {
    pub material_id: MaterialId,
    pub quantity: Decimal,
    pub unit_price: Money,
}

impl InvoiceLine {
    pub fn new(material_id: MaterialId, quantity: Decimal, unit_price: Money) -> Self {
        Self {
            material_id,
            quantity,
            unit_price,
        }
    }

    pub fn line_total(&self) -> Money {
        self.unit_price.clone() * self.quantity
    }
}
