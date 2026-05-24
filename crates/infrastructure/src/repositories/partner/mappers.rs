use application::errors::AppError;
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::ids::{PartnerId, AccountId};
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::{DateTime, Utc};
use super::models::PartnerRow;

pub fn row_to_partner(row: PartnerRow) -> Result<Partner, AppError> {
    let sharing_type = match row.profit_sharing_type.as_str() {
        "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
        "BasedOnCapitalOriginal" => ProfitSharingType::BasedOnCapitalOriginal,
        "Manual" => ProfitSharingType::Manual,
        _ => ProfitSharingType::Manual,
    };

    Ok(Partner {
        id: row.id.parse::<PartnerId>().map_err(|e| AppError::Infrastructure(e.to_string()))?,
        code: row.code,
        name: row.name,
        exchange_rate: Decimal::from_str(&row.exchange_rate).unwrap_or_default(),
        amount_local: Decimal::from_str(&row.amount_local).unwrap_or_default(),
        amount_original: Decimal::from_str(&row.amount_original).unwrap_or_default(),
        is_amount_in_original: row.is_amount_in_original,
        profit_sharing_ratio: row.profit_sharing_ratio.and_then(|r| Decimal::from_str(&r).ok()),
        profit_sharing_type: sharing_type,
        linked_account_id: row.linked_account_id.and_then(|id| AccountId::from_str(&id).ok()),
        drawings_account_id: row.drawings_account_id.and_then(|id| AccountId::from_str(&id).ok()),
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
