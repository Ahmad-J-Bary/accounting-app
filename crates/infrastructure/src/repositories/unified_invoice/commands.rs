use sqlx::SqlitePool;
use application::errors::AppError;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType, InvoiceStatus, PaymentMethod};
use domain::shared::ids::{InvoiceId};
use uuid::Uuid;

pub async fn save(pool: &SqlitePool, invoice: &UnifiedInvoice) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let itype = match invoice.invoice_type {
        InvoiceType::Sales => "Sales",
        InvoiceType::Purchase => "Purchase",
        InvoiceType::OpeningBalance => "OpeningBalance",
    };

    let istatus = match invoice.status {
        InvoiceStatus::Draft => "Draft",
        InvoiceStatus::Posted => "Posted",
        InvoiceStatus::Cancelled => "Cancelled",
        InvoiceStatus::Reversed => "Reversed",
    };

    let pmeth = match invoice.payment_method {
        PaymentMethod::Cash => "Cash",
        PaymentMethod::Deferred => "Deferred",
        PaymentMethod::Partial => "Partial",
    };

    sqlx::query(
        "INSERT INTO unified_invoices (id, invoice_number, invoice_type, customer_id, customer_name, supplier_id, supplier_name, tax_amount, discount_amount, total_amount, payment_method, amount_paid, status, issued_at, notes, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(invoice.id.to_string())
    .bind(&invoice.invoice_number)
    .bind(itype)
    .bind(invoice.customer_id.as_ref().map(|id| id.to_string()))
    .bind(&invoice.customer_name)
    .bind(invoice.supplier_id.as_ref().map(|id| id.to_string()))
    .bind(&invoice.supplier_name)
    .bind(invoice.tax_amount.amount().to_string())
    .bind(invoice.discount_amount.amount().to_string())
    .bind(invoice.total_amount.amount().to_string())
    .bind(pmeth)
    .bind(invoice.amount_paid.amount().to_string())
    .bind(istatus)
    .bind(invoice.issued_at.to_rfc3339())
    .bind(&invoice.notes)
    .bind(invoice.created_at.to_rfc3339())
    .bind(invoice.updated_at.to_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for line in &invoice.lines {
        sqlx::query(
            "INSERT INTO unified_invoice_lines (id, invoice_id, material_id, quantity, unit_price, purchase_price, retail_price, wholesale_price, semi_wholesale_price, minimum_stock, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(invoice.id.to_string())
        .bind(line.material_id.to_string())
        .bind(line.quantity.to_string())
        .bind(line.unit_price.amount().to_string())
        .bind(line.purchase_price.as_ref().map(|m| m.amount().to_string()))
        .bind(line.retail_price.as_ref().map(|m| m.amount().to_string()))
        .bind(line.wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(line.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(line.minimum_stock.as_ref().map(|s| s.to_string()))
        .bind(&line.notes)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, invoice: &UnifiedInvoice) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let istatus = match invoice.status {
        InvoiceStatus::Draft => "Draft",
        InvoiceStatus::Posted => "Posted",
        InvoiceStatus::Cancelled => "Cancelled",
        InvoiceStatus::Reversed => "Reversed",
    };

    let pmeth = match invoice.payment_method {
        PaymentMethod::Cash => "Cash",
        PaymentMethod::Deferred => "Deferred",
        PaymentMethod::Partial => "Partial",
    };

    sqlx::query(
        "UPDATE unified_invoices SET status=?, tax_amount=?, discount_amount=?, total_amount=?, payment_method=?, amount_paid=?, notes=?, updated_at=?, customer_id=?, customer_name=?, supplier_id=?, supplier_name=? WHERE id=?"
    )
    .bind(istatus)
    .bind(invoice.tax_amount.amount().to_string())
    .bind(invoice.discount_amount.amount().to_string())
    .bind(invoice.total_amount.amount().to_string())
    .bind(pmeth)
    .bind(invoice.amount_paid.amount().to_string())
    .bind(&invoice.notes)
    .bind(invoice.updated_at.to_rfc3339())
    .bind(invoice.customer_id.as_ref().map(|id| id.to_string()))
    .bind(&invoice.customer_name)
    .bind(invoice.supplier_id.as_ref().map(|id| id.to_string()))
    .bind(&invoice.supplier_name)
    .bind(invoice.id.to_string())
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if invoice.status == InvoiceStatus::Draft {
        sqlx::query("DELETE FROM unified_invoice_lines WHERE invoice_id = ?")
            .bind(invoice.id.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for line in &invoice.lines {
            sqlx::query(
                "INSERT INTO unified_invoice_lines (id, invoice_id, material_id, quantity, unit_price, purchase_price, retail_price, wholesale_price, semi_wholesale_price, minimum_stock, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(Uuid::new_v4().to_string())
            .bind(invoice.id.to_string())
            .bind(line.material_id.to_string())
            .bind(line.quantity.to_string())
            .bind(line.unit_price.amount().to_string())
            .bind(line.purchase_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.retail_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.wholesale_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
            .bind(line.minimum_stock.as_ref().map(|s| s.to_string()))
            .bind(&line.notes)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }
    }

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &InvoiceId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM unified_invoices WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
