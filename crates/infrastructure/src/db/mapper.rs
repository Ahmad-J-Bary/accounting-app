use sqlx::Row;
use domain::shared::{Money, Currency};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub fn map_uuid(row: &sqlx::sqlite::SqliteRow, col: &str) -> Uuid {
    Uuid::parse_str(row.get(col)).unwrap_or_default()
}

pub fn map_decimal(row: &sqlx::sqlite::SqliteRow, col: &str) -> Decimal {
    Decimal::from_str(row.get(col)).unwrap_or_default()
}

pub fn map_money(row: &sqlx::sqlite::SqliteRow, amount_col: &str, currency_col: &str) -> Money {
    let amount = map_decimal(row, amount_col);
    let currency_code: String = row.get(currency_col);
    let currency = Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
    Money::new(amount, currency)
}

pub fn map_datetime(row: &sqlx::sqlite::SqliteRow, col: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(row.get(col))
        .unwrap_or_default()
        .with_timezone(&Utc)
}
