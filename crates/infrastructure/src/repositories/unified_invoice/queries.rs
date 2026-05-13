use sqlx::SqlitePool;
use application::errors::AppError;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType};
use domain::sales::invoice_line::InvoiceLine;
use domain::shared::ids::{InvoiceId, MaterialId};
use domain::shared::money::Money;
use domain::shared::MonetaryAmount;
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
        let fx_rate = Decimal::from_str(&r.exchange_rate).unwrap_or(Decimal::ONE);
        let lines = get_lines(pool, &r.id, &r.currency_code, fx_rate).await?;
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
        let fx_rate = Decimal::from_str(&r.exchange_rate).unwrap_or(Decimal::ONE);
        let lines = get_lines(pool, &r.id, &r.currency_code, fx_rate).await?;
        invoices.push(row_to_invoice(r, lines)?);
    }
    Ok(invoices)
}

pub async fn list_by_type(pool: &SqlitePool, invoice_type: InvoiceType) -> Result<Vec<UnifiedInvoice>, AppError> {
    let itype = match invoice_type {
        InvoiceType::Sales => "Sales",
        InvoiceType::Purchase => "Purchase",
        InvoiceType::PurchaseCosts => "PurchaseCosts",
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
        let fx_rate = Decimal::from_str(&r.exchange_rate).unwrap_or(Decimal::ONE);
        let lines = get_lines(pool, &r.id, &r.currency_code, fx_rate).await?;
        invoices.push(row_to_invoice(r, lines)?);
    }
    Ok(invoices)
}

pub async fn get_lines(pool: &SqlitePool, invoice_id: &str, currency_code: &str, fx_rate: Decimal) -> Result<Vec<InvoiceLine>, AppError> {
    let rows = sqlx::query_as::<_, LineRow>("SELECT * FROM unified_invoice_lines WHERE invoice_id = ?")
        .bind(invoice_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut lines = vec![];
    for r in rows {
        let material_id = MaterialId(Uuid::parse_str(&r.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?);
        let quantity = Decimal::from_str(&r.quantity).unwrap_or(Decimal::ZERO);
        
        let to_monetary = |amt_str: String| {
            let amt = Decimal::from_str(&amt_str).unwrap_or(Decimal::ZERO);
            MonetaryAmount::new(Money::from_amount_and_code(amt, currency_code), fx_rate)
        };
        
        let to_opt_monetary = |s: Option<String>| s.map(to_monetary);
        
        let parse_money = |s: Option<String>| s.and_then(|v| Decimal::from_str(&v).ok().map(|amt| Money::from_amount_and_code(amt, currency_code)));
        
        lines.push(InvoiceLine::new(
            material_id,
            quantity,
            to_monetary(r.unit_price),
            to_opt_monetary(r.purchase_price),
            to_opt_monetary(r.retail_price),
            to_opt_monetary(r.wholesale_price),
            to_opt_monetary(r.semi_wholesale_price),
            r.minimum_stock.and_then(|v| Decimal::from_str(&v).ok()),
            r.unit_id,
            r.conversion_factor.and_then(|v| Decimal::from_str(&v).ok()),
            r.notes,
            parse_money(r.unit_price_usd),
            parse_money(r.purchase_price_usd),
            parse_money(r.profit_amount_usd),
        ));
    }
    Ok(lines)
}

pub async fn get_last_usd_prices(pool: &SqlitePool, material_id: &str) -> Result<(String, String), AppError> {
    // Fetch last purchase USD price
    let last_purchase: Option<String> = sqlx::query_scalar(
        r#"
        SELECT l.unit_price_usd 
        FROM unified_invoice_lines l
        JOIN unified_invoices i ON l.invoice_id = i.id
        WHERE l.material_id = ? AND i.invoice_type IN ('Purchase', 'OpeningBalance') AND l.unit_price_usd IS NOT NULL
        ORDER BY i.issued_at DESC
        LIMIT 1
        "#
    )
    .bind(material_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    // Fetch last sale USD price
    let last_sale: Option<String> = sqlx::query_scalar(
        r#"
        SELECT l.unit_price_usd 
        FROM unified_invoice_lines l
        JOIN unified_invoices i ON l.invoice_id = i.id
        WHERE l.material_id = ? AND i.invoice_type = 'Sales' AND l.unit_price_usd IS NOT NULL
        ORDER BY i.issued_at DESC
        LIMIT 1
        "#
    )
    .bind(material_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok((
        last_purchase.unwrap_or_else(|| "0".to_string()),
        last_sale.unwrap_or_else(|| "0".to_string())
    ))
}

pub async fn get_next_invoice_number(pool: &SqlitePool, invoice_type: &str) -> Result<String, AppError> {
    let (query, has_param) = match invoice_type {
        "Purchase" | "OpeningBalance" => 
            ("SELECT MAX(CAST(invoice_number AS INTEGER)) FROM unified_invoices WHERE invoice_type IN ('Purchase', 'OpeningBalance')", false),
        _ => ("SELECT MAX(CAST(invoice_number AS INTEGER)) FROM unified_invoices WHERE invoice_type = ?", true),
    };

    let row: (Option<i64>,) = if has_param {
        sqlx::query_as(query).bind(invoice_type).fetch_one(pool).await
    } else {
        sqlx::query_as(query).fetch_one(pool).await
    }.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    
    let next = match row.0 {
        Some(n) => n + 1,
        None => 1,
    };
    Ok(next.to_string())
}
