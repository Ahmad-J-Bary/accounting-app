use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::supplier_repository::SupplierRepository;
use domain::suppliers::Supplier;
use domain::shared::ids::SupplierId;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

pub struct SqliteSupplierRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteSupplierRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct SupplierRow {
    id: String,
    name: String,
    phone: String,
    email: Option<String>,
    address: Option<String>,
    balance: String,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

fn row_to_supplier(row: SupplierRow) -> Result<Supplier, AppError> {
    Ok(Supplier {
        id: SupplierId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        balance: Decimal::from_str(&row.balance).unwrap_or(Decimal::ZERO),
        is_active: row.is_active,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl SupplierRepository for SqliteSupplierRepository {
    async fn save(&self, supplier: &Supplier) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO suppliers (id, name, phone, email, address, balance, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(supplier.id.to_string())
        .bind(&supplier.name)
        .bind(&supplier.phone)
        .bind(&supplier.email)
        .bind(&supplier.address)
        .bind(supplier.balance.to_string())
        .bind(supplier.is_active)
        .bind(supplier.created_at.to_rfc3339())
        .bind(supplier.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &SupplierId) -> Result<Option<Supplier>, AppError> {
        let row = sqlx::query_as::<_, SupplierRow>(
            "SELECT id, name, phone, email, address, balance, is_active, created_at, updated_at
             FROM suppliers WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_supplier).transpose()
    }

    async fn find_by_name(&self, name: &str) -> Result<Vec<Supplier>, AppError> {
        let rows = sqlx::query_as::<_, SupplierRow>(
            "SELECT id, name, phone, email, address, balance, is_active, created_at, updated_at
             FROM suppliers WHERE name LIKE ?"
        )
        .bind(format!("%{}%", name))
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_supplier).collect()
    }

    async fn list_all(&self) -> Result<Vec<Supplier>, AppError> {
        let rows = sqlx::query_as::<_, SupplierRow>(
            "SELECT id, name, phone, email, address, balance, is_active, created_at, updated_at
             FROM suppliers ORDER BY name"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_supplier).collect()
    }

    async fn update(&self, supplier: &Supplier) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE suppliers SET name=?, phone=?, email=?, address=?, balance=?, is_active=?, updated_at=?
             WHERE id=?"
        )
        .bind(&supplier.name)
        .bind(&supplier.phone)
        .bind(&supplier.email)
        .bind(&supplier.address)
        .bind(supplier.balance.to_string())
        .bind(supplier.is_active)
        .bind(supplier.updated_at.to_rfc3339())
        .bind(supplier.id.to_string())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &SupplierId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM suppliers WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

