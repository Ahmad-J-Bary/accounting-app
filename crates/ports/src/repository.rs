// Repository interfaces

use async_trait::async_trait;

// Generic repository trait
#[async_trait]
pub trait Repository<T, ID> {
    async fn find_by_id(&self, id: ID) -> Result<Option<T>, Box<dyn std::error::Error + Send + Sync>>;
    async fn find_all(&self) -> Result<Vec<T>, Box<dyn std::error::Error + Send + Sync>>;
    async fn save(&self, entity: T) -> Result<T, Box<dyn std::error::Error + Send + Sync>>;
    async fn delete(&self, id: ID) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
}

// Example specific repository traits
pub trait InvoiceRepository: Repository<Invoice, String> {
    async fn find_by_customer_id(&self, customer_id: String) -> Result<Vec<Invoice>, Box<dyn std::error::Error + Send + Sync>>;
}

pub trait CustomerRepository: Repository<Customer, String> {
    async fn find_by_email(&self, email: String) -> Result<Option<Customer>, Box<dyn std::error::Error + Send + Sync>>;
}

// Placeholder types
pub struct Invoice;
pub struct Customer;
