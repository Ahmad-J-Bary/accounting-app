use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use application::errors::AppError;
use application::ports::invoice_repository::InvoiceRepository;
use domain::sales::{Invoice, InvoiceLine};
use domain::shared::{InvoiceId, CustomerId, ProductId, Money};
use std::sync::Arc;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;

pub struct SqliteInvoiceRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteInvoiceRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl InvoiceRepository for SqliteInvoiceRepository {
    async fn save(&self, invoice: &Invoice) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        // 1. Save or Update Header
        sqlx::query(
            r#"
            INSERT INTO sales_invoices (
                id, invoice_number, customer_id, subtotal, tax_amount, 
                discount_amount, total, status, invoice_date, 
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                updated_at = excluded.updated_at
            "#
        )
        .bind(invoice.id.0.to_string())
        .bind(&invoice.invoice_number)
        .bind(invoice.customer_id.0.to_string())
        .bind(invoice.subtotal().amount().to_string())
        .bind(invoice.tax_amount.amount().to_string())
        .bind(invoice.discount_amount.amount().to_string())
        .bind(invoice.total().amount().to_string())
        .bind(if invoice.posted { "Posted" } else { "Draft" })
        .bind(invoice.issued_at.to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        // 2. Clear existing lines if any (for updates)
        sqlx::query("DELETE FROM sales_invoice_items WHERE sales_invoice_id = ?")
            .bind(invoice.id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        // 3. Save Lines
        for line in &invoice.lines {
            sqlx::query(
                r#"
                INSERT INTO sales_invoice_items (
                    id, sales_invoice_id, product_id, quantity, unit_price, line_total
                ) VALUES (?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(invoice.id.0.to_string())
            .bind(line.product_id.0.to_string())
            .bind(line.quantity.to_string())
            .bind(line.unit_price.amount().to_string())
            .bind(line.line_total().amount().to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        tx.commit().await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        
        Ok(())
    }

    async fn find_by_id(&self, id: &InvoiceId) -> Result<Option<Invoice>, AppError> {
        let header = sqlx::query("SELECT * FROM sales_invoices WHERE id = ?")
            .bind(id.0.to_string())
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = header {
            let lines = self.get_lines_for_invoice(id).await?;
            Ok(Some(self.map_row_to_invoice(row, lines)?))
        } else {
            Ok(None)
        }
    }

    async fn list_for_customer(&self, customer_id: uuid::Uuid) -> Result<Vec<Invoice>, AppError> {
        let rows = sqlx::query("SELECT * FROM sales_invoices WHERE customer_id = ?")
            .bind(customer_id.to_string())
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut invoices = Vec::new();
        for row in rows {
            let id_str: String = row.get("id");
            let id = InvoiceId(uuid::Uuid::parse_str(&id_str).unwrap());
            let lines = self.get_lines_for_invoice(&id).await?;
            invoices.push(self.map_row_to_invoice(row, lines)?);
        }
        Ok(invoices)
    }

    async fn list_all(&self) -> Result<Vec<Invoice>, AppError> {
        let rows = sqlx::query("SELECT * FROM sales_invoices ORDER BY invoice_date DESC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut invoices = Vec::new();
        for row in rows {
            let id_str: String = row.get("id");
            let id = InvoiceId(uuid::Uuid::parse_str(&id_str).unwrap());
            let lines = self.get_lines_for_invoice(&id).await?;
            invoices.push(self.map_row_to_invoice(row, lines)?);
        }
        Ok(invoices)
    }

    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM sales_invoices WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

impl SqliteInvoiceRepository {
    async fn get_lines_for_invoice(&self, id: &InvoiceId) -> Result<Vec<InvoiceLine>, AppError> {
        let rows = sqlx::query("SELECT * FROM sales_invoice_items WHERE sales_invoice_id = ?")
            .bind(id.0.to_string())
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut lines = Vec::new();
        for row in rows {
            let product_id_str: String = row.get("product_id");
            let quantity_str: String = row.get("quantity");
            let price_str: String = row.get("unit_price");

            lines.push(InvoiceLine::new(
                ProductId(uuid::Uuid::parse_str(&product_id_str).unwrap()),
                Decimal::from_str(&quantity_str).unwrap_or(Decimal::ZERO),
                Money::new(Decimal::from_str(&price_str).unwrap_or(Decimal::ZERO))
            ));
        }
        Ok(lines)
    }

    fn map_row_to_invoice(&self, row: sqlx::sqlite::SqliteRow, lines: Vec<InvoiceLine>) -> Result<Invoice, AppError> {
        let id_str: String = row.get("id");
        let num: String = row.get("invoice_number");
        let customer_id_str: String = row.get("customer_id");
        let tax_str: String = row.get("tax_amount");
        let disc_str: String = row.get("discount_amount");
        let status: String = row.get("status");
        let date_str: String = row.get("invoice_date");

        Ok(Invoice {
            id: InvoiceId(uuid::Uuid::parse_str(&id_str).unwrap()),
            invoice_number: num,
            customer_id: CustomerId(uuid::Uuid::parse_str(&customer_id_str).unwrap()),
            lines,
            tax_amount: Money::new(Decimal::from_str(&tax_str).unwrap_or(Decimal::ZERO)),
            discount_amount: Money::new(Decimal::from_str(&disc_str).unwrap_or(Decimal::ZERO)),
            issued_at: DateTime::from_str(&date_str).unwrap_or(Utc::now()),
            posted: status == "Posted",
        })
    }
}
