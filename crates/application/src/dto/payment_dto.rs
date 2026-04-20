use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentDto {
    pub id: String,
    pub payment_type: String,
    pub amount: String,
    pub payment_date: String,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePaymentRequest {
    pub payment_type: String,
    pub amount: f64,
    pub payment_date: String,
    pub customer_id: Option<String>,
    pub supplier_id: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
}
