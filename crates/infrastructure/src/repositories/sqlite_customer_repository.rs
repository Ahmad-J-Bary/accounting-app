use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::customer_repository::CustomerRepository;
use domain::customers::Customer;
use domain::shared::{CustomerId, AccountId, Currency};
use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

pub struct SqliteCustomerRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCustomerRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct CustomerRow {
    id: String,
    code: String,
    name: String,
    phone: Option<String>,
    address: Option<String>,
    account_id: Option<String>,
    debit: String,
    credit: String,
    opening_balance: String,
    balance: String,
    currency: String,
    notes: Option<String>,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

fn row_to_customer(row: CustomerRow) -> Result<Customer, AppError> {
    let currency = match row.currency.as_str() {
        "USD" => Currency::USD,
        _ => Currency::SYP,
    };

    Ok(Customer {
        id: CustomerId::from_u64(row.id.parse::<u64>().unwrap_or(0)),
        code: row.code,
        name: row.name,
        phone: row.phone,
        address: row.address,
        account_id: row.account_id.and_then(|s| Uuid::parse_str(&s).ok()).map(AccountId),
        debit: Decimal::from_str(&row.debit).unwrap_or(Decimal::ZERO),
        credit: Decimal::from_str(&row.credit).unwrap_or(Decimal::ZERO),
        opening_balance: Decimal::from_str(&row.opening_balance).unwrap_or(Decimal::ZERO),
        balance: Decimal::from_str(&row.balance).unwrap_or(Decimal::ZERO),
        currency,
        notes: row.notes,
        is_active: row.is_active,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl CustomerRepository for SqliteCustomerRepository {
    async fn save(&self, customer: &Customer) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO customers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                code = excluded.code,
                name = excluded.name,
                phone = excluded.phone,
                address = excluded.address,
                account_id = excluded.account_id,
                debit = excluded.debit,
                credit = excluded.credit,
                opening_balance = excluded.opening_balance,
                balance = excluded.balance,
                currency = excluded.currency,
                notes = excluded.notes,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at"
        )
        .bind(customer.id.to_string())
        .bind(&customer.code)
        .bind(&customer.name)
        .bind(&customer.phone)
        .bind(&customer.address)
        .bind(customer.account_id.as_ref().map(|id| id.0.to_string()))
        .bind(customer.debit.to_string())
        .bind(customer.credit.to_string())
        .bind(customer.opening_balance.to_string())
        .bind(customer.balance.to_string())
        .bind(customer.currency.code())
        .bind(&customer.notes)
        .bind(customer.is_active)
        .bind(customer.created_at.to_rfc3339())
        .bind(customer.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &CustomerId) -> Result<Option<Customer>, AppError> {
        let row = sqlx::query_as::<_, CustomerRow>(
            "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
             FROM customers WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_customer).transpose()
    }

    async fn find_by_account_id(&self, account_id: &AccountId) -> Result<Option<Customer>, AppError> {
        let row = sqlx::query_as::<_, CustomerRow>(
            "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
             FROM customers WHERE account_id = ?"
        )
        .bind(account_id.0.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_customer).transpose()
    }

    async fn list_all(&self) -> Result<Vec<Customer>, AppError> {
        let rows = sqlx::query_as::<_, CustomerRow>(
            "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
             FROM customers ORDER BY name"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_customer).collect()
    }

    async fn update(&self, customer: &Customer) -> Result<(), AppError> {
        self.save(customer).await
    }

    async fn delete(&self, id: &CustomerId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM customers WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}
