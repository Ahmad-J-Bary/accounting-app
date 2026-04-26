use crate::shared::money::Money;
use crate::shared::MaterialId;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLine {
    pub material_id: MaterialId,
    pub quantity: Decimal,
    pub unit_price: Money, // This is the price actually used for the invoice (e.g. Retail price chosen)
    pub purchase_price: Option<Money>,
    pub retail_price: Option<Money>,
    pub wholesale_price: Option<Money>,
    pub semi_wholesale_price: Option<Money>,
    pub minimum_stock: Option<Decimal>,
    pub notes: Option<String>,
}

impl InvoiceLine {
    pub fn new(
        material_id: MaterialId, 
        quantity: Decimal, 
        unit_price: Money,
        purchase_price: Option<Money>,
        retail_price: Option<Money>,
        wholesale_price: Option<Money>,
        semi_wholesale_price: Option<Money>,
        minimum_stock: Option<Decimal>,
        notes: Option<String>,
    ) -> Self {
        Self {
            material_id,
            quantity,
            unit_price,
            purchase_price,
            retail_price,
            wholesale_price,
            semi_wholesale_price,
            minimum_stock,
            notes,
        }
    }

    pub fn line_total(&self) -> Money {
        self.unit_price.clone() * self.quantity
    }
}
