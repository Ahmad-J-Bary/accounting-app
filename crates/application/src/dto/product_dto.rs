use domain::inventory::product::Product;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductDto {
    pub id: String,
    pub name: String,
    pub barcode: Option<String>,
    pub code: String,
    pub purchase_price: Option<String>,
    pub retail_price: Option<String>,
    pub wholesale_price: Option<String>,
    pub semi_wholesale_price: Option<String>,
    pub stock_quantity: String,
    pub minimum_stock: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProductRequest {
    pub name: String,
    pub barcode: Option<String>,
    pub code: String,
    pub purchase_price: Option<String>,
    pub retail_price: Option<String>,
    pub wholesale_price: Option<String>,
    pub semi_wholesale_price: Option<String>,
    pub initial_stock: String,
    pub minimum_stock: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProductRequest {
    pub id: String,
    pub name: String,
    pub barcode: Option<String>,
    pub code: String,
    pub purchase_price: Option<String>,
    pub retail_price: Option<String>,
    pub wholesale_price: Option<String>,
    pub semi_wholesale_price: Option<String>,
    pub stock_quantity: String,
    pub minimum_stock: String,
    pub is_active: bool,
}

impl From<Product> for ProductDto {
    fn from(product: Product) -> Self {
        Self {
            id: product.id.0.to_string(),
            name: product.name,
            barcode: product.barcode,
            code: product.code,
            purchase_price: product.purchase_price.map(|m| m.amount().to_string()),
            retail_price: product.retail_price.map(|m| m.amount().to_string()),
            wholesale_price: product.wholesale_price.map(|m| m.amount().to_string()),
            semi_wholesale_price: product.semi_wholesale_price.map(|m| m.amount().to_string()),
            stock_quantity: product.stock_quantity.to_string(),
            minimum_stock: product.minimum_stock.to_string(),
            is_active: product.is_active,
        }
    }
}
