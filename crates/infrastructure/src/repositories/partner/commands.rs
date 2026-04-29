use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::ids::{PartnerId};

pub async fn save(pool: &SqlitePool, partner: &Partner) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO partners (id, code, name, exchange_rate, amount_local, amount_usd, is_amount_in_usd, profit_sharing_ratio, profit_sharing_type, linked_account_id, drawings_account_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(partner.id.to_string())
    .bind(&partner.code)
    .bind(&partner.name)
    .bind(partner.exchange_rate.to_string())
    .bind(partner.amount_local.to_string())
    .bind(partner.amount_usd.to_string())
    .bind(partner.is_amount_in_usd)
    .bind(partner.profit_sharing_ratio.as_ref().map(|r| r.to_string()))
    .bind(match partner.profit_sharing_type {
        ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal",
        ProfitSharingType::BasedOnCapitalUSD => "BasedOnCapitalUSD",
        ProfitSharingType::Manual => "Manual",
    })
    .bind(partner.linked_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.drawings_account_id.as_ref().map(|id| id.to_string()))
    .bind(&partner.created_at)
    .bind(&partner.updated_at)
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn update(pool: &SqlitePool, partner: &Partner) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE partners SET code = ?, name = ?, exchange_rate = ?, amount_local = ?, amount_usd = ?, is_amount_in_usd = ?, profit_sharing_ratio = ?, profit_sharing_type = ?, linked_account_id = ?, drawings_account_id = ?, updated_at = ?
         WHERE id = ?"
    )
    .bind(&partner.code)
    .bind(&partner.name)
    .bind(partner.exchange_rate.to_string())
    .bind(partner.amount_local.to_string())
    .bind(partner.amount_usd.to_string())
    .bind(partner.is_amount_in_usd)
    .bind(partner.profit_sharing_ratio.as_ref().map(|r| r.to_string()))
    .bind(match partner.profit_sharing_type {
        ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal",
        ProfitSharingType::BasedOnCapitalUSD => "BasedOnCapitalUSD",
        ProfitSharingType::Manual => "Manual",
    })
    .bind(partner.linked_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.drawings_account_id.as_ref().map(|id| id.to_string()))
    .bind(&partner.updated_at)
    .bind(partner.id.to_string())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &PartnerId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM partners WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
