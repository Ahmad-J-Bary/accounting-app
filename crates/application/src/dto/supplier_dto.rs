use domain::suppliers::Supplier;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierDto {
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
pub struct CreateSupplierRequest {
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
pub struct UpdateSupplierRequest {
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
}

impl From<Supplier> for SupplierDto {
    fn from(supplier: Supplier) -> Self {
        Self {
            id: supplier.id.to_string(),
            code: supplier.code,
            name: supplier.name,
            phone: supplier.phone,
            address: supplier.address,
            account_id: supplier.account_id.map(|id| id.0.to_string()),
            debit: supplier.debit.to_string(),
            credit: supplier.credit.to_string(),
            opening_balance: supplier.opening_balance.to_string(),
            balance: supplier.balance.to_string(),
            currency: supplier.currency.code.clone(),
            notes: supplier.notes,
            is_active: supplier.is_active,
            created_at: supplier.created_at.to_rfc3339(),
            updated_at: supplier.updated_at.to_rfc3339(),
        }
    }
}
