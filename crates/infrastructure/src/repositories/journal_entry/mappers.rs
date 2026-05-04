use application::errors::AppError;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalEntryStatus};
use domain::shared::{JournalEntryId, AccountId, Money, MonetaryAmount};
use domain::shared::currency::Currency;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::{JournalEntryRow, JournalLineRow};

pub fn row_to_entry(row: JournalEntryRow, lines: Vec<JournalLine>) -> Result<JournalEntry, AppError> {
    let date = DateTime::parse_from_rfc3339(&row.entry_date)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    
    let mut entry = JournalEntry::new(
        row.entry_number,
        lines,
        date,
        row.description,
    ).map_err(|e| AppError::Invalid(e.to_string()))?;
    
    entry.id = JournalEntryId(Uuid::parse_str(&row.id).unwrap_or_default());
    entry.created_at = DateTime::parse_from_rfc3339(&row.created_at)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
        
    entry.posted_at = row.posted_at.and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
        .map(|d| d.with_timezone(&Utc));
        
    entry.status = match row.status.as_str() {
        "Posted" => JournalEntryStatus::Posted,
        "Cancelled" => JournalEntryStatus::Cancelled,
        _ => JournalEntryStatus::Draft,
    };

    Ok(entry)
}

pub fn row_to_line(r: JournalLineRow) -> JournalLine {
    let account_id = AccountId(Uuid::parse_str(&r.account_id).unwrap_or_default());
    let currency = match r.currency.as_str() {
        "USD" => Currency::usd(),
        _ => Currency::syp(),
    };
    let fx_rate = Decimal::from_str(&r.fx_rate).unwrap_or(Decimal::ONE);

    let debit = MonetaryAmount {
        original: Money::new(Decimal::from_str(&r.debit).unwrap_or(Decimal::ZERO), currency.clone()),
        base_amount: Decimal::from_str(&r.debit_base).unwrap_or(Decimal::ZERO),
        fx_rate,
    };
    let credit = MonetaryAmount {
        original: Money::new(Decimal::from_str(&r.credit).unwrap_or(Decimal::ZERO), currency.clone()),
        base_amount: Decimal::from_str(&r.credit_base).unwrap_or(Decimal::ZERO),
        fx_rate,
    };
    JournalLine::new(account_id, debit, credit, r.description)
}
