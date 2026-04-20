use async_trait::async_trait;
use sqlx::SqlitePool;
use core_application::errors::AppError;
use core_application::ports::product_repository::ProductRepository;
use core_domain::inventory::product::Product;
use core_domain::shared::ProductId;
use std::sync::Arc;

pub struct SqliteProductRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteProductRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ProductRepository for SqliteProductRepository {
    async fn save(&self, product: &Product) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO products (id, name, code, unit_price, cost_price, stock_quantity, minimum_stock, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(product.id.0.to_string())
        .bind(&product.name)
        .bind(&product.code)
        .bind(product.unit_price.amount().to_string())
        .bind(product.cost_price.amount().to_string())
        .bind(product.stock_quantity.to_string())
        .bind(product.minimum_stock.to_string())
        .bind(product.is_active)
        .bind(product.created_at)
        .bind(product.updated_at)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, _id: &ProductId) -> Result<Option<Product>, AppError> {
        // TODO: Implement database read
        Ok(None)
    }

    async fn list_all(&self) -> Result<Vec<Product>, AppError> {
        // TODO: Implement database read
        Ok(vec![])
    }

    async fn delete(&self, _id: &ProductId) -> Result<(), AppError> {
        // TODO: Implement database delete
        Ok(())
    }
}
