use std::sync::Arc;
use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::opening_detail_repository::OpeningDetailRepository;
use application::use_cases::opening_balance::types::{
    OpeningCustomerItem, OpeningDetailsDto, OpeningFixedAssetItem, OpeningInventoryItem,
    OpeningSupplierItem,
};
use rust_decimal::Decimal;
use std::str::FromStr;

pub struct SqliteOpeningDetailRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteOpeningDetailRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

fn rate(s: &str) -> Decimal {
    Decimal::from_str(s).unwrap_or(Decimal::ONE)
}

#[async_trait]
impl OpeningDetailRepository for SqliteOpeningDetailRepository {
    async fn replace_details(&self, migration_id: &str, d: &OpeningDetailsDto) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for table in [
            "opening_balance_customer_items",
            "opening_balance_supplier_items",
            "opening_balance_inventory_items",
            "opening_balance_fixed_assets",
        ] {
            let q = format!("DELETE FROM {table} WHERE migration_id = ?");
            sqlx::query(&q).bind(migration_id).execute(&mut *tx).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        for it in &d.customer_items {
            sqlx::query(
                "INSERT INTO opening_balance_customer_items (id, migration_id, customer_id, reference, original_amount, outstanding_amount, due_date, currency_code, exchange_rate, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(migration_id).bind(&it.customer_id).bind(&it.reference)
            .bind(&it.original_amount).bind(&it.outstanding_amount).bind(&it.due_date)
            .bind(&it.currency_code)
            .bind(it.exchange_rate.as_deref().map(rate).unwrap_or(Decimal::ONE).to_string())
            .execute(&mut *tx).await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }
        for it in &d.supplier_items {
            sqlx::query(
                "INSERT INTO opening_balance_supplier_items (id, migration_id, supplier_id, reference, original_amount, outstanding_amount, due_date, currency_code, exchange_rate, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(migration_id).bind(&it.supplier_id).bind(&it.reference)
            .bind(&it.original_amount).bind(&it.outstanding_amount).bind(&it.due_date)
            .bind(&it.currency_code)
            .bind(it.exchange_rate.as_deref().map(rate).unwrap_or(Decimal::ONE).to_string())
            .execute(&mut *tx).await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }
        for it in &d.inventory_items {
            sqlx::query(
                "INSERT INTO opening_balance_inventory_items (id, migration_id, material_id, warehouse_id, quantity, unit_cost, total_cost, batch, currency_code, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(migration_id).bind(&it.material_id).bind(&it.warehouse_id)
            .bind(&it.quantity).bind(&it.unit_cost).bind(&it.total_cost).bind(&it.batch)
            .bind(&it.currency_code)
            .execute(&mut *tx).await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }
        for it in &d.fixed_assets {
            sqlx::query(
                "INSERT INTO opening_balance_fixed_assets (id, migration_id, asset_id, acquisition_cost, accumulated_depreciation, net_book_value, acquisition_date, depreciation_method, useful_life, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(migration_id).bind(&it.asset_id).bind(&it.acquisition_cost)
            .bind(&it.accumulated_depreciation).bind(&it.net_book_value)
            .bind(&it.acquisition_date).bind(&it.depreciation_method).bind(&it.useful_life)
            .execute(&mut *tx).await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))
    }

    async fn load_details(&self, migration_id: &str) -> Result<OpeningDetailsDto, AppError> {
        let customers = sqlx::query_as::<_, SqliteCustomerRow>(
            "SELECT customer_id, reference, original_amount, outstanding_amount, due_date, currency_code, exchange_rate FROM opening_balance_customer_items WHERE migration_id = ?"
        )
        .bind(migration_id).fetch_all(&*self.pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        let suppliers = sqlx::query_as::<_, SqliteSupplierRow>(
            "SELECT supplier_id, reference, original_amount, outstanding_amount, due_date, currency_code, exchange_rate FROM opening_balance_supplier_items WHERE migration_id = ?"
        )
        .bind(migration_id).fetch_all(&*self.pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        let inventory = sqlx::query_as::<_, SqliteInventoryRow>(
            "SELECT material_id, warehouse_id, quantity, unit_cost, total_cost, batch, currency_code FROM opening_balance_inventory_items WHERE migration_id = ?"
        )
        .bind(migration_id).fetch_all(&*self.pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        let assets = sqlx::query_as::<_, SqliteAssetRow>(
            "SELECT asset_id, acquisition_cost, accumulated_depreciation, net_book_value, acquisition_date, depreciation_method, useful_life FROM opening_balance_fixed_assets WHERE migration_id = ?"
        )
        .bind(migration_id).fetch_all(&*self.pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(OpeningDetailsDto {
            customer_items: customers.into_iter().map(|r| OpeningCustomerItem {
                customer_id: r.customer_id,
                reference: r.reference,
                original_amount: r.original_amount,
                outstanding_amount: r.outstanding_amount,
                due_date: r.due_date,
                currency_code: r.currency_code,
                exchange_rate: Some(r.exchange_rate),
            }).collect(),
            supplier_items: suppliers.into_iter().map(|r| OpeningSupplierItem {
                supplier_id: r.supplier_id,
                reference: r.reference,
                original_amount: r.original_amount,
                outstanding_amount: r.outstanding_amount,
                due_date: r.due_date,
                currency_code: r.currency_code,
                exchange_rate: Some(r.exchange_rate),
            }).collect(),
            inventory_items: inventory.into_iter().map(|r| OpeningInventoryItem {
                material_id: r.material_id,
                warehouse_id: r.warehouse_id,
                quantity: r.quantity,
                unit_cost: r.unit_cost,
                total_cost: r.total_cost,
                batch: r.batch,
                currency_code: r.currency_code,
            }).collect(),
            fixed_assets: assets.into_iter().map(|r| OpeningFixedAssetItem {
                asset_id: r.asset_id,
                acquisition_cost: r.acquisition_cost,
                accumulated_depreciation: r.accumulated_depreciation,
                net_book_value: r.net_book_value,
                acquisition_date: r.acquisition_date,
                depreciation_method: r.depreciation_method,
                useful_life: r.useful_life,
            }).collect(),
        })
    }
}

#[derive(sqlx::FromRow)]
struct SqliteCustomerRow {
    customer_id: String,
    reference: Option<String>,
    original_amount: String,
    outstanding_amount: String,
    due_date: Option<String>,
    currency_code: Option<String>,
    exchange_rate: String,
}
#[derive(sqlx::FromRow)]
struct SqliteSupplierRow {
    supplier_id: String,
    reference: Option<String>,
    original_amount: String,
    outstanding_amount: String,
    due_date: Option<String>,
    currency_code: Option<String>,
    exchange_rate: String,
}
#[derive(sqlx::FromRow)]
struct SqliteInventoryRow {
    material_id: String,
    warehouse_id: Option<String>,
    quantity: String,
    unit_cost: String,
    total_cost: String,
    batch: Option<String>,
    currency_code: Option<String>,
}
#[derive(sqlx::FromRow)]
struct SqliteAssetRow {
    asset_id: String,
    acquisition_cost: String,
    accumulated_depreciation: String,
    net_book_value: String,
    acquisition_date: Option<String>,
    depreciation_method: Option<String>,
    useful_life: Option<String>,
}
