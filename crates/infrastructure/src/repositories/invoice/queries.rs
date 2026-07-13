use sqlx::SqlitePool;
use std::collections::HashMap;
use application::errors::AppError;
use domain::sales::{Invoice, InvoiceLine};
use domain::shared::ids::{InvoiceId, CustomerId};
use domain::shared::currency::Currency;
use super::models::{InvoiceRow, InvoiceItemRow};
use super::mappers::{row_to_invoice, item_row_to_line};

pub async fn get_base_currency_from_db(pool: &SqlitePool) -> Result<Currency, AppError> {
    let code: Option<String> = sqlx::query_scalar(
        "SELECT code FROM currencies WHERE is_base = 1 LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let code = code.unwrap_or_default();
    let info = application::world_currencies::find_world_currency(&code);
    if let Some(info) = info {
        Ok(Currency::new(&info.code, &info.name_ar, &info.name_en, &info.symbol, info.decimals, true))
    } else {
        Ok(Currency::new(&code, &code, &code, &code, 2, true))
    }
}

pub async fn get_lines_for_invoice(pool: &SqlitePool, id: &InvoiceId, base_currency: &Currency) -> Result<Vec<InvoiceLine>, AppError> {
    let rows = sqlx::query_as::<_, InvoiceItemRow>(
        "SELECT id, sales_invoice_id, material_id, quantity, unit_price, line_total FROM sales_invoice_items WHERE sales_invoice_id = ?"
    )
    .bind(id.0.to_string())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut lines = Vec::new();
    for r in rows {
        lines.push(item_row_to_line(r, base_currency)?);
    }
    Ok(lines)
}

pub async fn get_items_for_multiple_invoices(
    pool: &SqlitePool,
    invoice_ids: &[String],
) -> Result<HashMap<String, Vec<InvoiceItemRow>>, AppError> {
    if invoice_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<&str> = vec!["?"; invoice_ids.len()];
    let sql = format!(
        "SELECT id, sales_invoice_id, material_id, quantity, unit_price, line_total FROM sales_invoice_items WHERE sales_invoice_id IN ({})",
        placeholders.join(", ")
    );

    let mut query = sqlx::query_as::<_, InvoiceItemRow>(&sql);
    for id in invoice_ids {
        query = query.bind(id);
    }

    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut map: HashMap<String, Vec<InvoiceItemRow>> = HashMap::new();
    for r in rows {
        map.entry(r.sales_invoice_id.clone()).or_default().push(r);
    }
    Ok(map)
}

pub async fn find_by_id(pool: &SqlitePool, id: &InvoiceId) -> Result<Option<Invoice>, AppError> {
    let row = sqlx::query_as::<_, InvoiceRow>("SELECT * FROM sales_invoices WHERE id = ?")
        .bind(id.0.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let base_currency = get_base_currency_from_db(pool).await?;
        let lines = get_lines_for_invoice(pool, id, &base_currency).await?;
        Ok(Some(row_to_invoice(r, lines, &base_currency)?))
    } else {
        Ok(None)
    }
}

pub async fn list_for_customer(pool: &SqlitePool, customer_id: CustomerId) -> Result<Vec<Invoice>, AppError> {
    let rows = sqlx::query_as::<_, InvoiceRow>("SELECT * FROM sales_invoices WHERE customer_id = ?")
        .bind(customer_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if rows.is_empty() {
        return Ok(vec![]);
    }

    let base_currency = get_base_currency_from_db(pool).await?;
    let invoice_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let mut items_map = get_items_for_multiple_invoices(pool, &invoice_ids).await?;

    let mut invoices = Vec::new();
    for r in rows {
        let item_rows = items_map.remove(&r.id).unwrap_or_default();
        let mut lines = Vec::new();
        for ir in item_rows {
            lines.push(item_row_to_line(ir, &base_currency)?);
        }
        invoices.push(row_to_invoice(r, lines, &base_currency)?);
    }
    Ok(invoices)
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Invoice>, AppError> {
    let rows = sqlx::query_as::<_, InvoiceRow>("SELECT * FROM sales_invoices ORDER BY invoice_date DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if rows.is_empty() {
        return Ok(vec![]);
    }

    let base_currency = get_base_currency_from_db(pool).await?;
    let invoice_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let mut items_map = get_items_for_multiple_invoices(pool, &invoice_ids).await?;

    let mut invoices = Vec::new();
    for r in rows {
        let item_rows = items_map.remove(&r.id).unwrap_or_default();
        let mut lines = Vec::new();
        for ir in item_rows {
            lines.push(item_row_to_line(ir, &base_currency)?);
        }
        invoices.push(row_to_invoice(r, lines, &base_currency)?);
    }
    Ok(invoices)
}
