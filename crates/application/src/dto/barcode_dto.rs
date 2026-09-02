use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ResolveBarcodeRequest {
    pub value: String,
    pub source: Option<String>,
    pub symbology: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BarcodeMatchDto {
    pub matched: bool,
    pub normalized_value: String,
    pub material_id: Option<String>,
    pub material_code: Option<String>,
    pub material_name: Option<String>,
    pub matched_unit_name: Option<String>,
    pub source: Option<String>,
}
