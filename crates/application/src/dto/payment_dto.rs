use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentDto {
    pub id: String,
    pub voucher_number: String,
    pub payment_type: String,
    pub amount: String,
    pub currency_code: String,
    pub exchange_rate: String,
    pub payment_date: String,
    pub debit_account_id: Option<String>,
    pub credit_account_id: Option<String>,
    pub journal_entry_number: Option<String>,
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
    pub voucher_number: Option<String>,
    pub payment_type: String,
    pub amount: f64,
    pub currency_code: Option<String>,
    pub exchange_rate: Option<f64>,
    pub payment_date: String,
    pub debit_account_id: Option<String>,
    pub credit_account_id: Option<String>,
    pub customer_id: Option<String>,
    pub supplier_id: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
}
