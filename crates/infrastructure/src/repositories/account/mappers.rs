use application::errors::AppError;
use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::shared::ids::{AccountId, CustomerId, SupplierId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::AccountRow;

pub fn row_to_account(row: AccountRow) -> Result<Account, AppError> {
    let account_type = match row.account_type.as_str() {
        "Assets" => AccountType::Assets,
        "Liabilities" => AccountType::Liabilities,
        "Equity" => AccountType::Equity,
        "Revenue" => AccountType::Revenue,
        "Expenses" => AccountType::Expenses,
        _ => AccountType::Assets,
    };

    let category = match row.category.as_deref() {
        Some("Summary") => AccountCategory::Summary,
        _ => AccountCategory::Detail,
    };

    Ok(Account {
        id: AccountId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        code: row.code,
        name_ar: row.name_ar,
        name_en: row.name_en,
        account_type,
        parent_id: row.parent_id.and_then(|s| Uuid::parse_str(&s).ok()).map(AccountId),
        category,
        level: row.level.unwrap_or(1),
        opening_balance: Decimal::from_str(&row.opening_balance).unwrap_or(Decimal::ZERO),
        balance: Decimal::from_str(&row.balance).unwrap_or(Decimal::ZERO),
        notes: row.notes,
        is_active: row.is_active,
        is_default: row.is_default.unwrap_or(false),
        is_final: row.is_final.unwrap_or(false),
        linked_customer_id: row.linked_customer_id.and_then(|s| s.parse::<CustomerId>().ok()),
        linked_supplier_id: row.linked_supplier_id.and_then(|s| s.parse::<SupplierId>().ok()),
        debit: Decimal::from_str(&row.debit).unwrap_or(Decimal::ZERO),
        credit: Decimal::from_str(&row.credit).unwrap_or(Decimal::ZERO),
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
