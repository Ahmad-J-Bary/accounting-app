use super::models::{PurchaseInvoiceAdditionalCostRow, PurchaseInvoiceItemRow, PurchaseInvoiceRow};
use application::errors::AppError;
use chrono::{DateTime, Utc};
use domain::purchases::purchase_invoice::PurchaseAdditionalCost;
use domain::purchases::{PurchaseInvoice, PurchaseInvoiceItem, PurchaseInvoiceStatus};
use domain::shared::ids::{AccountId, MaterialId, PurchaseInvoiceId, SupplierId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

pub fn row_to_invoice(
    row: PurchaseInvoiceRow,
    items: Vec<PurchaseInvoiceItem>,
    additional_costs: Vec<PurchaseAdditionalCost>,
) -> Result<PurchaseInvoice, AppError> {
    let status = match row.status.as_str() {
        "Posted" => PurchaseInvoiceStatus::Posted,
        "Cancelled" => PurchaseInvoiceStatus::Cancelled,
        "Paid" => PurchaseInvoiceStatus::Paid,
        "PartiallyPaid" => PurchaseInvoiceStatus::PartiallyPaid,
        _ => PurchaseInvoiceStatus::Draft,
    };

    Ok(PurchaseInvoice {
        id: PurchaseInvoiceId(
            Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        ),
        invoice_number: row.invoice_number,
        supplier_id: row.supplier_id.parse::<SupplierId>().unwrap_or_default(),
        items,
        additional_costs,
        subtotal: Decimal::from_str(&row.subtotal).unwrap_or(Decimal::ZERO),
        tax_amount: Decimal::from_str(&row.tax_amount).unwrap_or(Decimal::ZERO),
        discount_amount: Decimal::from_str(&row.discount_amount).unwrap_or(Decimal::ZERO),
        total: Decimal::from_str(&row.total).unwrap_or(Decimal::ZERO),
        amount_paid: Decimal::from_str(&row.amount_paid).unwrap_or(Decimal::ZERO),
        status,
        invoice_date: DateTime::parse_from_rfc3339(&row.invoice_date)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        due_date: row.due_date.as_ref().and_then(|d| {
            DateTime::parse_from_rfc3339(d)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        }),
        currency_code: row.currency_code,
        exchange_rate: Decimal::from_str(&row.exchange_rate).unwrap_or(Decimal::ONE),
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

pub fn item_row_to_item(row: PurchaseInvoiceItemRow) -> Result<PurchaseInvoiceItem, AppError> {
    Ok(PurchaseInvoiceItem {
        id: row.id,
        material_id: MaterialId(
            Uuid::parse_str(&row.material_id)
                .map_err(|e| AppError::Infrastructure(e.to_string()))?,
        ),
        quantity: Decimal::from_str(&row.quantity).unwrap_or(Decimal::ZERO),
        unit_id: row.unit_id,
        conversion_factor: row
            .conversion_factor
            .and_then(|s| Decimal::from_str(&s).ok()),
        unit_price: Decimal::from_str(&row.unit_price).unwrap_or(Decimal::ZERO),
        line_total: Decimal::from_str(&row.line_total).unwrap_or(Decimal::ZERO),
        notes: row.notes,
    })
}

pub fn cost_row_to_cost(
    row: PurchaseInvoiceAdditionalCostRow,
) -> Result<PurchaseAdditionalCost, AppError> {
    Ok(PurchaseAdditionalCost {
        id: row.id,
        description: row.description,
        account_id: AccountId(
            Uuid::parse_str(&row.account_id)
                .map_err(|e| AppError::Infrastructure(e.to_string()))?,
        ),
        amount: Decimal::from_str(&row.amount).unwrap_or(Decimal::ZERO),
    })
}
