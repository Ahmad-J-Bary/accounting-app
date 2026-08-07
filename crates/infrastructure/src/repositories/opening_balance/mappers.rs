use super::models::{MigrationRow, MigrationLineRow};
use application::errors::AppError;
use domain::accounting::{OpeningBalanceMigration, OpeningBalanceLine, MigrationStatus};
use domain::shared::AccountId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;

pub fn row_to_migration(row: MigrationRow, lines: Vec<OpeningBalanceLine>) -> Result<OpeningBalanceMigration, AppError> {
    Ok(OpeningBalanceMigration {
        id: row.id,
        cutover_date: DateTime::parse_from_rfc3339(&row.cutover_date)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        status: MigrationStatus::from_str(&row.status),
        notes: row.notes,
        lines,
        posted_at: row.posted_at.and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
            .map(|d| d.with_timezone(&Utc)),
        created_at: DateTime::parse_from_rfc3339(&row.created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

pub fn row_to_line(r: MigrationLineRow) -> Result<OpeningBalanceLine, AppError> {
    let account_id = AccountId::from_str(&r.account_id)
        .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
    let amount = Decimal::from_str(&r.amount).unwrap_or(Decimal::ZERO);
    Ok(OpeningBalanceLine {
        account_id,
        amount,
        description: r.description,
    })
}

// Reconstructed from `new` so validate() stays in sync with the domain invariant.