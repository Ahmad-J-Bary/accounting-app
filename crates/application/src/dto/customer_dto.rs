use domain::customers::Customer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerDto {
    pub id: String,
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub account_id: Option<String>,
    pub debit: String,
    pub credit: String,
    pub opening_balance: String,
    pub balance: String,
    pub currency: String,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCustomerRequest {
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub account_id: Option<String>,
    pub debit: Option<String>,
    pub credit: Option<String>,
    pub opening_balance: Option<String>,
    pub currency: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCustomerRequest {
    pub id: String,
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub account_id: Option<String>,
    pub debit: Option<String>,
    pub credit: Option<String>,
    pub opening_balance: Option<String>,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
}

impl From<Customer> for CustomerDto {
    fn from(customer: Customer) -> Self {
        Self {
            id: customer.id.to_string(),
            code: customer.code,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            account_id: customer.account_id.map(|id| id.0.to_string()),
            debit: customer.debit.to_string(),
            credit: customer.credit.to_string(),
            opening_balance: customer.opening_balance.to_string(),
            balance: customer.balance.to_string(),
            currency: customer.currency.code().to_string(),
            notes: customer.notes,
            is_active: customer.is_active,
            created_at: customer.created_at.to_rfc3339(),
            updated_at: customer.updated_at.to_rfc3339(),
        }
    }
}
