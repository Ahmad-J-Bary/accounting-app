use super::models::{MigrationRow, MigrationLineRow};
use application::errors::AppError;
use domain::accounting::{OpeningBalanceMigration, OpeningBalanceLine, MigrationStatus, ResidualClassification};
use domain::shared::AccountId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;

pub fn row_to_migration(row: MigrationRow, lines: Vec<OpeningBalanceLine>) -> Result<OpeningBalanceMigration, AppError> {
    let ts = |s: Option<String>| {
        s.and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
            .map(|d| d.with_timezone(&Utc))
    };
    Ok(OpeningBalanceMigration {
        id: row.id,
        company_id: row.company_id,
        cutover_date: DateTime::parse_from_rfc3339(&row.cutover_date)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        source_system: row.source_system,
        source_reference: row.source_reference,
        residual_classification: row
            .residual_classification
            .as_deref()
            .and_then(ResidualClassification::from_str),
        residual_account_id: row
            .residual_account_id
            .and_then(|id| AccountId::from_str(&id).ok()),
        status: MigrationStatus::from_str(&row.status),
        notes: row.notes,
        lines,
        validated_by: row.validated_by,
        validated_at: ts(row.validated_at),
        approved_by: row.approved_by,
        approved_at: ts(row.approved_at),
        posted_at: ts(row.posted_at),
        locked_at: ts(row.locked_at),
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