#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreateTransferRequest {
    pub source_warehouse_id: String,
    pub dest_warehouse_id: String,
    pub material_id: String,
    pub quantity: String,
    pub transfer_date: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TransferResponse {
    pub reference: String,
    pub source_movement_id: String,
    pub dest_movement_id: String,
    pub source_warehouse_id: String,
    pub dest_warehouse_id: String,
    pub material_id: String,
    pub quantity: String,
    pub transfer_date: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UpdateTransferRequest {
    pub reference: String,
    pub source_warehouse_id: String,
    pub dest_warehouse_id: String,
    pub material_id: String,
    pub quantity: String,
    pub transfer_date: String,
    pub notes: Option<String>,
}
