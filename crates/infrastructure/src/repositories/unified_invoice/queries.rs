use sqlx::SqlitePool;
use application::errors::AppError;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType};
use domain::sales::invoice_line::InvoiceLine;
use domain::shared::ids::{InvoiceId, MaterialId};
use domain::shared::money::Money;
use std::str::FromStr;
use uuid::Uuid;
use rust_decimal::Decimal;
use super::models::{InvoiceRow, LineRow};
use super::mappers::row_to_invoice;

pub async fn find_by_id(pool: &SqlitePool, id: &InvoiceId) -> Result<Option<UnifiedInvoice>, AppError> {
    let row = sqlx::query_as::<_, InvoiceRow>(
        "SELECT * FROM unified_invoices WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let lines = get_lines(pool, &r.id).await?;
        Ok(Some(row_to_invoice(r, lines)?))
    } else {
        Ok(None)
    }
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<UnifiedInvoice>, AppError> {
    let rows = sqlx::query_as::<_, InvoiceRow>(
        "SELECT * FROM unified_invoices ORDER BY issued_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut invoices = vec![];
    for r in rows {
        let lines = get_lines(pool, &r.id).await?;
        invoices.push(row_to_invoice(r, lines)?);
    }
    Ok(invoices)
}

pub async fn list_by_type(pool: &SqlitePool, invoice_type: InvoiceType) -> Result<Vec<UnifiedInvoice>, AppError> {
    let itype = match invoice_type {
        InvoiceType::Sales => "Sales",
        InvoiceType::Purchase => "Purchase",
        InvoiceType::OpeningBalance => "OpeningBalance",
    };

    let rows = sqlx::query_as::<_, InvoiceRow>(
        "SELECT * FROM unified_invoices WHERE invoice_type = ? ORDER BY issued_at DESC"
    )
    .bind(itype)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut invoices = vec![];
    for r in rows {
        let lines = get_lines(pool, &r.id).await?;
        invoices.push(row_to_invoice(r, lines)?);
    }
    Ok(invoices)
}

pub async fn get_lines(pool: &SqlitePool, invoice_id: &str) -> Result<Vec<InvoiceLine>, AppError> {
    let rows = sqlx::query_as::<_, LineRow>("SELECT * FROM unified_invoice_lines WHERE invoice_id = ?")
        .bind(invoice_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut lines = vec![];
    for r in rows {
        let material_id = MaterialId(Uuid::parse_str(&r.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?);
        let quantity = Decimal::from_str(&r.quantity).unwrap_or(Decimal::ZERO);
        let unit_price = Money::syp(Decimal::from_str(&r.unit_price).unwrap_or(Decimal::ZERO));
        
        let parse_money = |s: Option<String>| s.and_then(|v| Decimal::from_str(&v).ok().map(Money::syp));
        
        lines.push(InvoiceLine::new(
            material_id,
            quantity,
            unit_price,
            parse_money(r.purchase_price),
            parse_money(r.retail_price),
            parse_money(r.wholesale_price),
            parse_money(r.semi_wholesale_price),
            r.minimum_stock.and_then(|v| Decimal::from_str(&v).ok()),
            r.notes,
        ));
    }
    Ok(lines)
}
