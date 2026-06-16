#![allow(clippy::too_many_arguments)]
use crate::shared::money::Money;
use crate::shared::monetary_amount::MonetaryAmount;
use crate::shared::MaterialId;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLine {
    pub line_id: Option<String>,
    pub material_id: MaterialId,
    pub quantity: Decimal,
    pub unit_price: MonetaryAmount, // Encapsulates both original and base
    pub purchase_price: Option<MonetaryAmount>,
    pub retail_price: Option<MonetaryAmount>,
    pub wholesale_price: Option<MonetaryAmount>,
    pub semi_wholesale_price: Option<MonetaryAmount>,
    pub minimum_stock: Option<Decimal>,
    pub unit_id: Option<String>,
    pub conversion_factor: Option<Decimal>,
    pub warehouse_id: Option<String>,
    pub expiry_date: Option<String>,
    pub notes: Option<String>,

    pub unit_price_original: Option<Money>,
    pub purchase_price_original: Option<Money>,
    pub profit_amount_original: Option<Money>,
}

impl InvoiceLine {
    pub fn new(
        line_id: Option<String>,
        material_id: MaterialId, 
        quantity: Decimal, 
        unit_price: MonetaryAmount,
        purchase_price: Option<MonetaryAmount>,
        retail_price: Option<MonetaryAmount>,
        wholesale_price: Option<MonetaryAmount>,
        semi_wholesale_price: Option<MonetaryAmount>,
        minimum_stock: Option<Decimal>,
        unit_id: Option<String>,
        conversion_factor: Option<Decimal>,
        warehouse_id: Option<String>,
        expiry_date: Option<String>,
        notes: Option<String>,
        unit_price_original: Option<Money>,
        purchase_price_original: Option<Money>,
        profit_amount_original: Option<Money>,
    ) -> Self {
        Self {
            line_id,
            material_id,
            quantity,
            unit_price,
            purchase_price,
            retail_price,
            wholesale_price,
            semi_wholesale_price,
            minimum_stock,
            unit_id,
            conversion_factor,
            warehouse_id,
            expiry_date,
            notes,
            unit_price_original,
            purchase_price_original,
            profit_amount_original,
        }
    }

    pub fn line_total(&self) -> MonetaryAmount {
        self.unit_price.clone() * self.quantity
    }
}
