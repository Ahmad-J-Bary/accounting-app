use application::errors::AppError;
use domain::suppliers::Supplier;
use domain::shared::ids::SupplierId;
use domain::shared::{AccountId, Currency};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;
use super::models::SupplierRow;

pub fn row_to_supplier(row: SupplierRow) -> Result<Supplier, AppError> {
    let currency = match row.currency.as_str() {
        "USD" => Currency::USD,
        _ => Currency::SYP,
    };

    Ok(Supplier {
        id: SupplierId::from_u64(row.id.parse::<u64>().unwrap_or(0)),
        code: row.code,
        name: row.name,
        phone: row.phone,
        address: row.address,
        account_id: row.account_id.and_then(|s| Uuid::parse_str(&s).ok()).map(AccountId),
        debit: Decimal::from_str(&row.debit).unwrap_or(Decimal::ZERO),
        credit: Decimal::from_str(&row.credit).unwrap_or(Decimal::ZERO),
        opening_balance: Decimal::from_str(&row.opening_balance).unwrap_or(Decimal::ZERO),
        balance: Decimal::from_str(&row.balance).unwrap_or(Decimal::ZERO),
        currency,
        notes: row.notes,
        is_active: row.is_active,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}
