use crate::shared::ids::WarehouseId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Warehouse {
    pub id: WarehouseId,
    pub name: String,
    pub address: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
}
