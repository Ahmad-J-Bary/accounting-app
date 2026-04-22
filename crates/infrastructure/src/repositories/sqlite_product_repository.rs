use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::product_repository::ProductRepository;
use domain::inventory::product::Product;
use domain::shared::ProductId;
use std::sync::Arc;

pub struct SqliteProductRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteProductRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;
use domain::shared::money::Money;

#[derive(sqlx::FromRow)]
struct ProductRow {
    id: String,
    name: String,
    barcode: Option<String>,
    code: String,
    purchase_price: Option<String>,
    retail_price: Option<String>,
    wholesale_price: Option<String>,
    semi_wholesale_price: Option<String>,
    stock_quantity: String,
    minimum_stock: String,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

fn row_to_product(row: ProductRow) -> Result<Product, AppError> {
    let parse_money = |s: Option<String>| s.and_then(|v| Decimal::from_str(&v).ok().map(Money::syp));

    Ok(Product {
        id: ProductId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        name: row.name,
        barcode: row.barcode,
        code: row.code,
        purchase_price: parse_money(row.purchase_price),
        retail_price: parse_money(row.retail_price),
        wholesale_price: parse_money(row.wholesale_price),
        semi_wholesale_price: parse_money(row.semi_wholesale_price),
        stock_quantity: Decimal::from_str(&row.stock_quantity).unwrap_or(Decimal::ZERO),
        minimum_stock: Decimal::from_str(&row.minimum_stock).unwrap_or(Decimal::ZERO),
        is_active: row.is_active,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl ProductRepository for SqliteProductRepository {
    async fn save(&self, product: &Product) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO products (id, name, barcode, code, purchase_price, retail_price, wholesale_price, semi_wholesale_price, unit_price, cost_price, stock_quantity, minimum_stock, is_active, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(product.id.to_string())
        .bind(&product.name)
        .bind(&product.barcode)
        .bind(&product.code)
        .bind(product.purchase_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.retail_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.retail_price.as_ref().map(|m| m.amount().to_string()).unwrap_or_else(|| "0".to_string())) // fallback for legacy unit_price
        .bind(product.purchase_price.as_ref().map(|m| m.amount().to_string()).unwrap_or_else(|| "0".to_string())) // fallback for legacy cost_price
        .bind(product.stock_quantity.to_string())
        .bind(product.minimum_stock.to_string())
        .bind(product.is_active)
        .bind(product.created_at.to_rfc3339())
        .bind(product.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &ProductId) -> Result<Option<Product>, AppError> {
        let row = sqlx::query_as::<_, ProductRow>(
            "SELECT id, name, barcode, code, purchase_price, retail_price, wholesale_price, semi_wholesale_price, stock_quantity, minimum_stock, is_active, created_at, updated_at 
             FROM products WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_product).transpose()
    }

    async fn list_all(&self) -> Result<Vec<Product>, AppError> {
        let rows = sqlx::query_as::<_, ProductRow>(
            "SELECT id, name, barcode, code, purchase_price, retail_price, wholesale_price, semi_wholesale_price, stock_quantity, minimum_stock, is_active, created_at, updated_at 
             FROM products ORDER BY name"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_product).collect()
    }

    async fn update(&self, product: &Product) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE products SET name=?, barcode=?, code=?, purchase_price=?, retail_price=?, wholesale_price=?, semi_wholesale_price=?, unit_price=?, cost_price=?, stock_quantity=?, minimum_stock=?, is_active=?, updated_at=? 
             WHERE id=?"
        )
        .bind(&product.name)
        .bind(&product.barcode)
        .bind(&product.code)
        .bind(product.purchase_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.retail_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(product.retail_price.as_ref().map(|m| m.amount().to_string()).unwrap_or_else(|| "0".to_string()))
        .bind(product.purchase_price.as_ref().map(|m| m.amount().to_string()).unwrap_or_else(|| "0".to_string()))
        .bind(product.stock_quantity.to_string())
        .bind(product.minimum_stock.to_string())
        .bind(product.is_active)
        .bind(product.updated_at.to_rfc3339())
        .bind(product.id.to_string())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &ProductId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM products WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}
