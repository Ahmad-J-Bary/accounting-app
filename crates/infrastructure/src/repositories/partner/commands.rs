use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::account::{Account, AccountCategory};
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::ids::PartnerId;

pub async fn save(pool: &SqlitePool, partner: &Partner) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO partners (id, code, name, currency, exchange_rate, amount_local, amount_original, is_amount_in_original, profit_sharing_ratio, profit_sharing_type, linked_account_id, drawings_account_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(partner.id.to_string())
    .bind(&partner.code)
    .bind(&partner.name)
    .bind(&partner.currency.code)
    .bind(partner.exchange_rate.to_string())
    .bind(partner.amount_local.to_string())
    .bind(partner.amount_original.to_string())
    .bind(partner.is_amount_in_original)
    .bind(partner.profit_sharing_ratio.as_ref().map(|r| r.to_string()))
    .bind(match partner.profit_sharing_type {
        ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal",
        ProfitSharingType::BasedOnCapitalOriginal => "BasedOnCapitalOriginal",
        ProfitSharingType::Manual => "Manual",
    })
    .bind(partner.linked_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.drawings_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.created_at)
    .bind(partner.updated_at)
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

/// Atomically persists a partner plus its newly created capital and drawings
/// accounts inside a single SQLite transaction (Sec 14 / Sec 29).
pub async fn save_with_accounts(
    pool: &SqlitePool,
    partner: &Partner,
    capital_account: &Account,
    drawings_account: &Account,
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    insert_account_tx(&mut tx, capital_account).await?;
    insert_account_tx(&mut tx, drawings_account).await?;
    insert_partner_tx(&mut tx, partner).await?;

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

async fn insert_account_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    account: &Account,
) -> Result<(), AppError> {
    let category_str = match account.category {
        AccountCategory::Summary => "Summary",
        AccountCategory::Detail => "Detail",
    };
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, debit, credit, notes, is_active, is_default, is_final, linked_customer_id, linked_supplier_id, currency_code, exchange_rate, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(account.id.0.to_string())
    .bind(&account.code)
    .bind(&account.name_ar)
    .bind(&account.name_en)
    .bind(format!("{:?}", account.account_type))
    .bind(account.parent_id.as_ref().map(|id| id.0.to_string()))
    .bind(category_str)
    .bind(account.level)
    .bind(account.opening_balance.to_string())
    .bind(account.balance.to_string())
    .bind(account.debit.to_string())
    .bind(account.credit.to_string())
    .bind(&account.notes)
    .bind(account.is_active)
    .bind(account.is_default)
    .bind(account.is_final)
    .bind(account.linked_customer_id.as_ref().map(|id| id.0.to_string()))
    .bind(account.linked_supplier_id.as_ref().map(|id| id.0.to_string()))
    .bind(&account.currency.code)
    .bind(account.exchange_rate.to_string())
    .bind(account.created_at)
    .bind(account.updated_at)
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn insert_partner_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    partner: &Partner,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO partners (id, code, name, currency, exchange_rate, amount_local, amount_original, is_amount_in_original, profit_sharing_ratio, profit_sharing_type, linked_account_id, drawings_account_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(partner.id.to_string())
    .bind(&partner.code)
    .bind(&partner.name)
    .bind(&partner.currency.code)
    .bind(partner.exchange_rate.to_string())
    .bind(partner.amount_local.to_string())
    .bind(partner.amount_original.to_string())
    .bind(partner.is_amount_in_original)
    .bind(partner.profit_sharing_ratio.as_ref().map(|r| r.to_string()))
    .bind(match partner.profit_sharing_type {
        ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal",
        ProfitSharingType::BasedOnCapitalOriginal => "BasedOnCapitalOriginal",
        ProfitSharingType::Manual => "Manual",
    })
    .bind(partner.linked_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.drawings_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.created_at)
    .bind(partner.updated_at)
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, partner: &Partner) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE partners SET code = ?, name = ?, currency = ?, exchange_rate = ?, amount_local = ?, amount_original = ?, is_amount_in_original = ?, profit_sharing_ratio = ?, profit_sharing_type = ?, linked_account_id = ?, drawings_account_id = ?, updated_at = ?
         WHERE id = ?"
    )
    .bind(&partner.code)
    .bind(&partner.name)
    .bind(&partner.currency.code)
    .bind(partner.exchange_rate.to_string())
    .bind(partner.amount_local.to_string())
    .bind(partner.amount_original.to_string())
    .bind(partner.is_amount_in_original)
    .bind(partner.profit_sharing_ratio.as_ref().map(|r| r.to_string()))
    .bind(match partner.profit_sharing_type {
        ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal",
        ProfitSharingType::BasedOnCapitalOriginal => "BasedOnCapitalOriginal",
        ProfitSharingType::Manual => "Manual",
    })
    .bind(partner.linked_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.drawings_account_id.as_ref().map(|id| id.to_string()))
    .bind(partner.updated_at)
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

