use domain::inventory::product::Product;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductDto {
    pub id: String,
    pub name: String,
    pub code: String,
    pub unit_price: String,
    pub cost_price: String,
    pub stock_quantity: String,
    pub minimum_stock: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProductRequest {
    pub name: String,
    pub code: String,
    pub unit_price: String,
    pub cost_price: String,
    pub initial_stock: String,
    pub minimum_stock: String,
}

impl From<Product> for ProductDto {
    fn from(product: Product) -> Self {
        Self {
            id: product.id.0.to_string(),
            name: product.name,
            code: product.code,
            unit_price: product.unit_price.amount().to_string(),
            cost_price: product.cost_price.amount().to_string(),
            stock_quantity: product.stock_quantity.to_string(),
            minimum_stock: product.minimum_stock.to_string(),
            is_active: product.is_active,
        }
    }
}
