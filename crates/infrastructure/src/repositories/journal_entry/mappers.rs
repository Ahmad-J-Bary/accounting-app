use application::errors::AppError;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalEntryStatus, JournalType};
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
    
    let journal_type = match row.journal_type.as_str() {
        "CashReceipt" => JournalType::CashReceipt,
        "CashPayment" => JournalType::CashPayment,
        "CashOpeningBalance" => JournalType::CashOpeningBalance,
        "AccountOpeningBalance" => JournalType::AccountOpeningBalance,
        "CashJournal" => JournalType::CashJournal,
        "CashSalesJournal" => JournalType::CashSalesJournal,
        "CreditSalesJournal" => JournalType::CreditSalesJournal,
        "PurchaseJournal" => JournalType::PurchaseJournal,
        "PurchaseCostsJournal" => JournalType::PurchaseCostsJournal,
        _ => JournalType::GeneralJournal,
    };

    let entry_res = JournalEntry::new(
        row.entry_number,
        journal_type,
        lines,
        date,
        row.description,
        row.source_id,
    ).map_err(|e| AppError::Invalid(e.to_string()));

    let mut entry = entry_res?;
    
    entry.id = JournalEntryId(Uuid::parse_str(&row.id).unwrap_or_default());
    entry.created_at = DateTime::parse_from_rfc3339(&row.created_at)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    entry.updated_at = DateTime::parse_from_rfc3339(&row.updated_at)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
        
    entry.posted_at = row.posted_at.and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
        .map(|d| d.with_timezone(&Utc));
        
    entry.status = match row.status.as_str() {
        "Posted" => JournalEntryStatus::Posted,
        "Cancelled" => JournalEntryStatus::Cancelled,
        "Reversed" => JournalEntryStatus::Reversed,
        _ => JournalEntryStatus::Draft,
    };

    Ok(entry)
}

pub fn row_to_line(r: JournalLineRow) -> JournalLine {
    let account_id = AccountId(Uuid::parse_str(&r.account_id).unwrap_or_default());
    let partner_id = r.partner_id.and_then(|id| Uuid::parse_str(&id).ok());
    
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
    let mut line = JournalLine::new(account_id, debit, credit, r.description);
    line.partner_id = partner_id;
    line
}
