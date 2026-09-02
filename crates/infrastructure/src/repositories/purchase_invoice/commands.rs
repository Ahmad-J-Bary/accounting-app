use application::errors::AppError;
use domain::accounting::journal_entry::JournalEntry;
use domain::inventory::stock_movement::StockMovement;
use domain::purchases::PurchaseInvoice;
use domain::shared::ids::PurchaseInvoiceId;
use sqlx::SqlitePool;

/// Atomically posts a purchase invoice: stock movements, purchase journal (+
/// additional-cost journals) and the invoice status change all commit in ONE
/// transaction. Any failure rolls back the whole posting (Sec 9 atomicity).
pub async fn post_with_accounting(
    pool: &SqlitePool,
    invoice: &PurchaseInvoice,
    movements: &[StockMovement],
    entries: &[JournalEntry],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for movement in movements {
        crate::repositories::stock_movement::insert_movement_tx(&mut tx, movement).await?;
    }
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }

    sqlx::query(
        "UPDATE purchase_invoices SET status=?, amount_paid=?, total=?, subtotal=?, tax_amount=?, discount_amount=?, currency_code=?, exchange_rate=?, updated_at=?
         WHERE id=?"
    )
    .bind(format!("{:?}", invoice.status))
    .bind(invoice.amount_paid.to_string())
    .bind(invoice.total.to_string())
    .bind(invoice.subtotal.to_string())
    .bind(invoice.tax_amount.to_string())
    .bind(invoice.discount_amount.to_string())
    .bind(&invoice.currency_code)
    .bind(invoice.exchange_rate.to_string())
    .bind(invoice.updated_at.to_rfc3339())
    .bind(invoice.id.to_string())
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save(pool: &SqlitePool, invoice: &PurchaseInvoice) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query(
        "INSERT INTO purchase_invoices (id, invoice_number, supplier_id, subtotal, tax_amount, discount_amount, total, amount_paid, status, invoice_date, due_date, currency_code, exchange_rate, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(invoice.id.to_string())
    .bind(&invoice.invoice_number)
    .bind(invoice.supplier_id.to_string())
    .bind(invoice.subtotal.to_string())
    .bind(invoice.tax_amount.to_string())
    .bind(invoice.discount_amount.to_string())
    .bind(invoice.total.to_string())
    .bind(invoice.amount_paid.to_string())
    .bind(format!("{:?}", invoice.status))
    .bind(invoice.invoice_date.to_rfc3339())
    .bind(invoice.due_date.map(|d| d.to_rfc3339()))
    .bind(&invoice.currency_code)
    .bind(invoice.exchange_rate.to_string())
    .bind(&invoice.notes)
    .bind(invoice.created_at.to_rfc3339())
    .bind(invoice.updated_at.to_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for item in &invoice.items {
        sqlx::query(
            "INSERT INTO purchase_invoice_items (id, purchase_invoice_id, material_id, quantity, unit_price, line_total, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&item.id)
        .bind(invoice.id.to_string())
        .bind(item.material_id.to_string())
        .bind(item.quantity.to_string())
        .bind(item.unit_price.to_string())
        .bind(item.line_total.to_string())
        .bind(&item.notes)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }

    for cost in &invoice.additional_costs {
        sqlx::query(
            "INSERT INTO purchase_invoice_additional_costs (id, purchase_invoice_id, description, account_id, amount)
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&cost.id)
        .bind(invoice.id.to_string())
        .bind(&cost.description)
        .bind(cost.account_id.to_string())
        .bind(cost.amount.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, invoice: &PurchaseInvoice) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE purchase_invoices SET status=?, amount_paid=?, total=?, subtotal=?, tax_amount=?, discount_amount=?, currency_code=?, exchange_rate=?, updated_at=?
         WHERE id=?"
    )
    .bind(format!("{:?}", invoice.status))
    .bind(invoice.amount_paid.to_string())
    .bind(invoice.total.to_string())
    .bind(invoice.subtotal.to_string())
    .bind(invoice.tax_amount.to_string())
    .bind(invoice.discount_amount.to_string())
    .bind(&invoice.currency_code)
    .bind(invoice.exchange_rate.to_string())
    .bind(invoice.updated_at.to_rfc3339())
    .bind(invoice.id.to_string())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &PurchaseInvoiceId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM purchase_invoices WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
