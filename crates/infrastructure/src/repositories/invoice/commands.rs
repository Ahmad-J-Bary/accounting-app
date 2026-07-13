use sqlx::SqlitePool;
use application::errors::AppError;
use domain::sales::Invoice;
use domain::shared::ids::InvoiceId;
use chrono::Utc;

pub async fn save(pool: &SqlitePool, invoice: &Invoice) -> Result<(), AppError> {
    let mut tx = pool.begin().await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

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

    sqlx::query("DELETE FROM sales_invoice_items WHERE sales_invoice_id = ?")
        .bind(invoice.id.0.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for line in &invoice.lines {
        sqlx::query(
            r#"
            INSERT INTO sales_invoice_items (
                id, sales_invoice_id, material_id, quantity, unit_price, line_total
            ) VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(invoice.id.0.to_string())
        .bind(line.material_id.0.to_string())
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

pub async fn delete(pool: &SqlitePool, id: &InvoiceId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM sales_invoices WHERE id = ?")
        .bind(id.0.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
