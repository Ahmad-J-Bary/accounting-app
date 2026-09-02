use application::errors::AppError;
use domain::accounting::account::{Account, AccountCategory};
use domain::shared::ids::AccountId;
use sqlx::SqlitePool;

pub fn purpose_to_str(purpose: domain::accounting::account::AccountPurpose) -> &'static str {
    purpose.to_str()
}

/// Inserts a brand-new account inside an open transaction. A plain INSERT (never
/// INSERT OR REPLACE) so a duplicate account code surfaces as a constraint
/// error and rolls back the surrounding composite (Sec 9 atomicity).
pub(crate) async fn insert_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    account: &Account,
) -> Result<(), AppError> {
    let category_str = match account.category {
        AccountCategory::Summary => "Summary",
        AccountCategory::Detail => "Detail",
    };

    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, debit, credit, notes, is_active, is_default, is_final, linked_customer_id, linked_supplier_id, currency_code, exchange_rate, purpose, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
    .bind(purpose_to_str(account.purpose))
    .bind(account.created_at)
    .bind(account.updated_at)
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Upserts an account inside an open transaction (used when editing a partner —
/// renames + balance sync are the only mutated fields in customer/supplier
/// updates). All-or-nothing with the surrounding composite (Sec 9).
pub(crate) async fn upsert_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    account: &Account,
) -> Result<(), AppError> {
    let category_str = match account.category {
        AccountCategory::Summary => "Summary",
        AccountCategory::Detail => "Detail",
    };

    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, debit, credit, notes, is_active, is_default, is_final, linked_customer_id, linked_supplier_id, currency_code, exchange_rate, purpose, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            name_ar = excluded.name_ar,
            name_en = excluded.name_en,
            balance = excluded.balance,
            updated_at = excluded.updated_at"
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
    .bind(purpose_to_str(account.purpose))
    .bind(account.created_at)
    .bind(account.updated_at)
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Deletes an account inside an open transaction.
pub(crate) async fn delete_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    id: &AccountId,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM accounts WHERE id = ?")
        .bind(id.0.to_string())
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save(pool: &SqlitePool, account: &Account) -> Result<(), AppError> {
    let category_str = match account.category {
        AccountCategory::Summary => "Summary",
        AccountCategory::Detail => "Detail",
    };

    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, debit, credit, notes, is_active, is_default, is_final, linked_customer_id, linked_supplier_id, currency_code, exchange_rate, purpose, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            name_ar = excluded.name_ar,
            name_en = excluded.name_en,
            account_type = excluded.account_type,
            parent_id = excluded.parent_id,
            category = excluded.category,
            level = excluded.level,
            opening_balance = excluded.opening_balance,
            balance = excluded.balance,
            debit = excluded.debit,
            credit = excluded.credit,
            notes = excluded.notes,
            is_active = excluded.is_active,
            is_default = excluded.is_default,
            is_final = excluded.is_final,
            linked_customer_id = excluded.linked_customer_id,
            linked_supplier_id = excluded.linked_supplier_id,
            currency_code = excluded.currency_code,
            exchange_rate = excluded.exchange_rate,
            purpose = excluded.purpose,
            updated_at = excluded.updated_at"
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
    .bind(purpose_to_str(account.purpose))
    .bind(account.created_at)
    .bind(account.updated_at)
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &AccountId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM accounts WHERE id = ?")
        .bind(id.0.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
