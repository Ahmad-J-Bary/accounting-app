use domain::customers::Customer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerDto {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: String,
    pub address: Option<String>,
    pub balance: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCustomerRequest {
    pub name: String,
    pub email: Option<String>,
    pub phone: String,
    pub address: Option<String>,
}

impl From<Customer> for CustomerDto {
    fn from(customer: Customer) -> Self {
        Self {
            id: customer.id.to_string(),
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            balance: customer.balance.to_string(),
            is_active: customer.is_active,
            created_at: customer.created_at.to_rfc3339(),
            updated_at: customer.updated_at.to_rfc3339(),
        }
    }
}
