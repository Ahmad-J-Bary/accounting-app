use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::payment_repository::PaymentRepository;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{PaymentId, CustomerId, SupplierId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

pub struct SqlitePaymentRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePaymentRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct PaymentRow {
    id: String,
    payment_type: String,
    amount: String,
    payment_date: String,
    customer_id: Option<String>,
    supplier_id: Option<String>,
    reference: Option<String>,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

fn row_to_payment(row: PaymentRow) -> Result<Payment, AppError> {
    let payment_type = match row.payment_type.as_str() {
        "Receipt" => PaymentType::Receipt,
        "SupplierPayment" => PaymentType::SupplierPayment,
        "CashIn" => PaymentType::CashIn,
        "CashOut" => PaymentType::CashOut,
        _ => PaymentType::Other,
    };
    Ok(Payment {
        id: PaymentId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        payment_type,
        amount: Decimal::from_str(&row.amount).unwrap_or(Decimal::ZERO),
        payment_date: DateTime::parse_from_rfc3339(&row.payment_date).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        customer_id: row.customer_id.map(|id| CustomerId(Uuid::parse_str(&id).unwrap())),
        supplier_id: row.supplier_id.map(|id| SupplierId(Uuid::parse_str(&id).unwrap())),
        reference: row.reference,
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl PaymentRepository for SqlitePaymentRepository {
    async fn save(&self, payment: &Payment) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO payments (id, payment_type, amount, payment_date, customer_id, supplier_id, reference, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(payment.id.to_string())
        .bind(format!("{:?}", payment.payment_type))
        .bind(payment.amount.to_string())
        .bind(payment.payment_date.to_rfc3339())
        .bind(payment.customer_id.as_ref().map(|c| c.to_string()))
        .bind(payment.supplier_id.as_ref().map(|s| s.to_string()))
        .bind(&payment.reference)
        .bind(&payment.notes)
        .bind(payment.created_at.to_rfc3339())
        .bind(payment.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &PaymentId) -> Result<Option<Payment>, AppError> {
        let row = sqlx::query_as::<_, PaymentRow>(
            "SELECT id, payment_type, amount, payment_date, customer_id, supplier_id, reference, notes, created_at, updated_at
             FROM payments WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        row.map(row_to_payment).transpose()
    }

    async fn list_all(&self) -> Result<Vec<Payment>, AppError> {
        let rows = sqlx::query_as::<_, PaymentRow>(
            "SELECT id, payment_type, amount, payment_date, customer_id, supplier_id, reference, notes, created_at, updated_at
             FROM payments ORDER BY payment_date DESC"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        rows.into_iter().map(row_to_payment).collect()
    }

    async fn list_by_customer(&self, customer_id: &CustomerId) -> Result<Vec<Payment>, AppError> {
        let rows = sqlx::query_as::<_, PaymentRow>(
            "SELECT id, payment_type, amount, payment_date, customer_id, supplier_id, reference, notes, created_at, updated_at
             FROM payments WHERE customer_id = ? ORDER BY payment_date DESC"
        )
        .bind(customer_id.to_string())
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        rows.into_iter().map(row_to_payment).collect()
    }

    async fn list_by_supplier(&self, supplier_id: &SupplierId) -> Result<Vec<Payment>, AppError> {
        let rows = sqlx::query_as::<_, PaymentRow>(
            "SELECT id, payment_type, amount, payment_date, customer_id, supplier_id, reference, notes, created_at, updated_at
             FROM payments WHERE supplier_id = ? ORDER BY payment_date DESC"
        )
        .bind(supplier_id.to_string())
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        rows.into_iter().map(row_to_payment).collect()
    }

    async fn delete(&self, id: &PaymentId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM payments WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

