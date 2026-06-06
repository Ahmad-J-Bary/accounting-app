use domain::inventory::inventory_lot::InventoryLot;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryLotDto {
    pub id: String,
    pub material_id: String,
    pub purchase_invoice_id: Option<String>,
    pub movement_id: String,
    pub quantity_original: String,
    pub quantity_remaining: String,
    pub unit_cost_base: String,
    pub raw_unit_cost_base: String,
    pub currency_code: Option<String>,
    pub fx_rate: String,
    pub purchase_date: String,
    pub created_at: String,
}

impl From<InventoryLot> for InventoryLotDto {
    fn from(lot: InventoryLot) -> Self {
        Self {
            id: lot.id.to_string(),
            material_id: lot.material_id.to_string(),
            purchase_invoice_id: lot.purchase_invoice_id.map(|id| id.to_string()),
            movement_id: lot.movement_id.to_string(),
            quantity_original: lot.quantity_original.to_string(),
            quantity_remaining: lot.quantity_remaining.to_string(),
            unit_cost_base: lot.unit_cost_base.to_string(),
            raw_unit_cost_base: lot.raw_unit_cost_base.to_string(),
            currency_code: lot.currency_code,
            fx_rate: lot.fx_rate.to_string(),
            purchase_date: lot.purchase_date.to_rfc3339(),
            created_at: lot.created_at.to_rfc3339(),
        }
    }
}
