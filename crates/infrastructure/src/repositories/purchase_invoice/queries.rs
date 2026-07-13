use sqlx::SqlitePool;
use std::collections::HashMap;
use application::errors::AppError;
use domain::purchases::{PurchaseInvoice, PurchaseInvoiceItem};
use domain::purchases::purchase_invoice::PurchaseAdditionalCost;
use domain::shared::ids::{PurchaseInvoiceId, SupplierId};
use super::models::{PurchaseInvoiceRow, PurchaseInvoiceItemRow, PurchaseInvoiceAdditionalCostRow};
use super::mappers::{row_to_invoice, item_row_to_item, cost_row_to_cost};

pub async fn load_items(pool: &SqlitePool, invoice_id: &str) -> Result<Vec<PurchaseInvoiceItem>, AppError> {
    let rows = sqlx::query_as::<_, PurchaseInvoiceItemRow>(
        "SELECT id, purchase_invoice_id, material_id, quantity, unit_id, conversion_factor, unit_price, line_total, notes
         FROM purchase_invoice_items WHERE purchase_invoice_id = ?"
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut items = Vec::new();
    for r in rows {
        items.push(item_row_to_item(r)?);
    }
    Ok(items)
}

pub async fn load_additional_costs(pool: &SqlitePool, invoice_id: &str) -> Result<Vec<PurchaseAdditionalCost>, AppError> {
    let rows = sqlx::query_as::<_, PurchaseInvoiceAdditionalCostRow>(
        "SELECT id, purchase_invoice_id, description, account_id, amount
         FROM purchase_invoice_additional_costs WHERE purchase_invoice_id = ?"
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut costs = Vec::new();
    for r in rows {
        costs.push(cost_row_to_cost(r)?);
    }
    Ok(costs)
}

pub async fn load_items_for_multiple_invoices(
    pool: &SqlitePool,
    invoice_ids: &[String],
) -> Result<HashMap<String, Vec<PurchaseInvoiceItemRow>>, AppError> {
    if invoice_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<&str> = vec!["?"; invoice_ids.len()];
    let sql = format!(
        "SELECT id, purchase_invoice_id, material_id, quantity, unit_id, conversion_factor, unit_price, line_total, notes FROM purchase_invoice_items WHERE purchase_invoice_id IN ({})",
        placeholders.join(", ")
    );

    let mut query = sqlx::query_as::<_, PurchaseInvoiceItemRow>(&sql);
    for id in invoice_ids {
        query = query.bind(id);
    }

    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut map: HashMap<String, Vec<PurchaseInvoiceItemRow>> = HashMap::new();
    for r in rows {
        map.entry(r.purchase_invoice_id.clone()).or_default().push(r);
    }
    Ok(map)
}

pub async fn load_costs_for_multiple_invoices(
    pool: &SqlitePool,
    invoice_ids: &[String],
) -> Result<HashMap<String, Vec<PurchaseInvoiceAdditionalCostRow>>, AppError> {
    if invoice_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<&str> = vec!["?"; invoice_ids.len()];
    let sql = format!(
        "SELECT id, purchase_invoice_id, description, account_id, amount FROM purchase_invoice_additional_costs WHERE purchase_invoice_id IN ({})",
        placeholders.join(", ")
    );

    let mut query = sqlx::query_as::<_, PurchaseInvoiceAdditionalCostRow>(&sql);
    for id in invoice_ids {
        query = query.bind(id);
    }

    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut map: HashMap<String, Vec<PurchaseInvoiceAdditionalCostRow>> = HashMap::new();
    for r in rows {
        map.entry(r.purchase_invoice_id.clone()).or_default().push(r);
    }
    Ok(map)
}

pub async fn find_by_id(pool: &SqlitePool, id: &PurchaseInvoiceId) -> Result<Option<PurchaseInvoice>, AppError> {
    let row = sqlx::query_as::<_, PurchaseInvoiceRow>(
        "SELECT * FROM purchase_invoices WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let items = load_items(pool, &r.id).await?;
        let additional_costs = load_additional_costs(pool, &r.id).await?;
        Ok(Some(row_to_invoice(r, items, additional_costs)?))
    } else {
        Ok(None)
    }
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<PurchaseInvoice>, AppError> {
    let rows = sqlx::query_as::<_, PurchaseInvoiceRow>(
        "SELECT * FROM purchase_invoices ORDER BY invoice_date DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if rows.is_empty() {
        return Ok(vec![]);
    }

    let invoice_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let mut items_map = load_items_for_multiple_invoices(pool, &invoice_ids).await?;
    let mut costs_map = load_costs_for_multiple_invoices(pool, &invoice_ids).await?;

    let mut invoices = Vec::new();
    for r in rows {
        let item_rows = items_map.remove(&r.id).unwrap_or_default();
        let cost_rows = costs_map.remove(&r.id).unwrap_or_default();

        let mut items = Vec::new();
        for ir in item_rows {
            items.push(item_row_to_item(ir)?);
        }

        let mut additional_costs = Vec::new();
        for cr in cost_rows {
            additional_costs.push(cost_row_to_cost(cr)?);
        }

        invoices.push(row_to_invoice(r, items, additional_costs)?);
    }
    Ok(invoices)
}

pub async fn list_by_supplier(pool: &SqlitePool, supplier_id: &SupplierId) -> Result<Vec<PurchaseInvoice>, AppError> {
    let rows = sqlx::query_as::<_, PurchaseInvoiceRow>(
        "SELECT * FROM purchase_invoices WHERE supplier_id = ? ORDER BY invoice_date DESC"
    )
    .bind(supplier_id.to_string())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if rows.is_empty() {
        return Ok(vec![]);
    }

    let invoice_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let mut items_map = load_items_for_multiple_invoices(pool, &invoice_ids).await?;
    let mut costs_map = load_costs_for_multiple_invoices(pool, &invoice_ids).await?;

    let mut invoices = Vec::new();
    for r in rows {
        let item_rows = items_map.remove(&r.id).unwrap_or_default();
        let cost_rows = costs_map.remove(&r.id).unwrap_or_default();

        let mut items = Vec::new();
        for ir in item_rows {
            items.push(item_row_to_item(ir)?);
        }

        let mut additional_costs = Vec::new();
        for cr in cost_rows {
            additional_costs.push(cost_row_to_cost(cr)?);
        }

        invoices.push(row_to_invoice(r, items, additional_costs)?);
    }
    Ok(invoices)
}
