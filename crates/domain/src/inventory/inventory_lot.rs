use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct InventoryLot {
    pub id: Uuid,
    pub material_id: Uuid,
    pub purchase_invoice_id: Option<Uuid>,
    pub movement_id: Uuid,
    pub quantity_original: Decimal,
    pub quantity_remaining: Decimal,
    pub unit_cost_base: Decimal,
    pub raw_unit_cost_base: Decimal,
    pub currency_code: Option<String>,
    pub fx_rate: Decimal,
    pub purchase_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct LotConsumption {
    pub lot_id: Uuid,
    pub quantity: Decimal,
    pub unit_cost_base: Decimal,
}
