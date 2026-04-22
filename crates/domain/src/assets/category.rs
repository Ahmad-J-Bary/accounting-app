use uuid::Uuid;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AssetType {
    Fixed,
    Consumable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetCategory {
    pub id: Uuid,
    pub name: String,
    pub asset_type: AssetType,
}

impl AssetCategory {
    pub fn new(name: String, asset_type: AssetType) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            asset_type,
        }
    }
}
