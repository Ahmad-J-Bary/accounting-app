use crate::ports::customer_repository::Customer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerDto {
    pub id: String,
    pub name: String,
    pub email: String,
    pub phone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCustomerRequest {
    pub name: String,
    pub email: String,
    pub phone: String,
}

impl From<Customer> for CustomerDto {
    fn from(customer: Customer) -> Self {
        Self {
            id: customer.id.0.to_string(),
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
        }
    }
}
