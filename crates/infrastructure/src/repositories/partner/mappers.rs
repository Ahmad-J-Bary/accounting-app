use super::models::PartnerRow;
use application::errors::AppError;
use chrono::{DateTime, Utc};
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::ids::{AccountId, PartnerId};
use domain::shared::Currency;
use rust_decimal::Decimal;
use std::str::FromStr;

pub fn row_to_partner(row: PartnerRow) -> Result<Partner, AppError> {
    let sharing_type = match row.profit_sharing_type.as_str() {
        "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
        "BasedOnCapitalOriginal" => ProfitSharingType::BasedOnCapitalOriginal,
        "Manual" => ProfitSharingType::Manual,
        other => {
            eprintln!(
                "⚠️ Unknown profit_sharing_type '{}' for partner {}, defaulting to Manual",
                other, row.id
            );
            ProfitSharingType::Manual
        }
    };

    // Construct Currency from the stored code. Decimal precision and is_base
    // are resolved at the currency-context layer; the partner row only stores
    // the code. Using code for all name fields is a known limitation — the
    // full currency metadata lives in the `currencies` table and is resolved
    // when the CurrencyContext loads.
    let currency = Currency::new(&row.currency, &row.currency, &row.currency, "", 2, false);

    let exchange_rate = Decimal::from_str(&row.exchange_rate).map_err(|e| {
        eprintln!(
            "⚠️ Corrupt exchange_rate '{}' for partner {}: {}",
            row.exchange_rate, row.id, e
        );
        AppError::Infrastructure(format!("سعر صرف غير صالح للشريك {}: {}", row.name, e))
    })?;

    let amount_local = Decimal::from_str(&row.amount_local).map_err(|e| {
        eprintln!(
            "⚠️ Corrupt amount_local '{}' for partner {}: {}",
            row.amount_local, row.id, e
        );
        AppError::Infrastructure(format!("مبلغ محلي غير صالح للشريك {}: {}", row.name, e))
    })?;

    let amount_original = Decimal::from_str(&row.amount_original).map_err(|e| {
        eprintln!(
            "⚠️ Corrupt amount_original '{}' for partner {}: {}",
            row.amount_original, row.id, e
        );
        AppError::Infrastructure(format!("مبلغ أصلي غير صالح للشريك {}: {}", row.name, e))
    })?;

    let linked_account_id = match &row.linked_account_id {
        Some(id) => Some(AccountId::from_str(id).map_err(|e| {
            eprintln!(
                "⚠️ Corrupt linked_account_id '{}' for partner {}: {}",
                id, row.id, e
            );
            AppError::Infrastructure(format!(
                "معرف حساب رأسمال غير صالح للشريك {}: {}",
                row.name, e
            ))
        })?),
        None => None,
    };

    let drawings_account_id = match &row.drawings_account_id {
        Some(id) => Some(AccountId::from_str(id).map_err(|e| {
            eprintln!(
                "⚠️ Corrupt drawings_account_id '{}' for partner {}: {}",
                id, row.id, e
            );
            AppError::Infrastructure(format!(
                "معرف حساب مسحوبات غير صالح للشريك {}: {}",
                row.name, e
            ))
        })?),
        None => None,
    };

    let current_account_id = match &row.current_account_id {
        Some(id) => Some(AccountId::from_str(id).map_err(|e| {
            eprintln!(
                "⚠️ Corrupt current_account_id '{}' for partner {}: {}",
                id, row.id, e
            );
            AppError::Infrastructure(format!(
                "معرف حساب جاري غير صالح للشريك {}: {}",
                row.name, e
            ))
        })?),
        None => None,
    };

    let created_at = DateTime::parse_from_rfc3339(&row.created_at)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| {
            eprintln!(
                "⚠️ Corrupt created_at '{}' for partner {}: {}",
                row.created_at, row.id, e
            );
            AppError::Infrastructure(format!("تاريخ إنشاء غير صالح للشريك {}: {}", row.name, e))
        })?;

    let updated_at = DateTime::parse_from_rfc3339(&row.updated_at)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| {
            eprintln!(
                "⚠️ Corrupt updated_at '{}' for partner {}: {}",
                row.updated_at, row.id, e
            );
            AppError::Infrastructure(format!("تاريخ تعديل غير صالح للشريك {}: {}", row.name, e))
        })?;

    Ok(Partner {
        id: row
            .id
            .parse::<PartnerId>()
            .map_err(|e| AppError::Infrastructure(e.to_string()))?,
        code: row.code,
        name: row.name,
        currency,
        exchange_rate,
        amount_local,
        amount_original,
        is_amount_in_original: row.is_amount_in_original,
        profit_sharing_ratio: row
            .profit_sharing_ratio
            .and_then(|r| Decimal::from_str(&r).ok()),
        profit_sharing_type: sharing_type,
        linked_account_id,
        drawings_account_id,
        current_account_id,
        notes: row.notes,
        created_at,
        updated_at,
    })
}
