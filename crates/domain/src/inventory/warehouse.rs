use serde::{Deserialize, Serialize};
use crate::shared::ids::WarehouseId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Warehouse {
    pub id: WarehouseId,
    pub name: String,
    pub code: String,
    pub address: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
}
