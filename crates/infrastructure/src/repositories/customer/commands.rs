use application::errors::AppError;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::customers::Customer;
use domain::shared::ids::JournalEntryId;
use domain::shared::{AccountId, CustomerId};
use sqlx::SqlitePool;

pub async fn save(pool: &SqlitePool, customer: &Customer) -> Result<(), AppError> {
    upsert_tx_free(pool, customer).await
}

/// Upserts a customer row in its own transaction (used by the plain `save` /
/// `update` port methods).
async fn upsert_tx_free(pool: &SqlitePool, customer: &Customer) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO customers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            name = excluded.name,
            phone = excluded.phone,
            address = excluded.address,
            account_id = excluded.account_id,
            debit = excluded.debit,
            credit = excluded.credit,
            opening_balance = excluded.opening_balance,
            balance = excluded.balance,
            currency = excluded.currency,
            notes = excluded.notes,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at"
    )
    .bind(customer.id.to_string())
    .bind(&customer.code)
    .bind(&customer.name)
    .bind(customer.phone.as_deref().unwrap_or(""))
    .bind(customer.address.as_deref().unwrap_or(""))
    .bind(customer.account_id.as_ref().map(|id| id.0.to_string()))
    .bind(customer.debit.to_string())
    .bind(customer.credit.to_string())
    .bind(customer.opening_balance.to_string())
    .bind(customer.balance.to_string())
    .bind(&customer.currency.code)
    .bind(&customer.notes)
    .bind(customer.is_active)
    .bind(customer.created_at.to_rfc3339())
    .bind(customer.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically persists a new customer together with its linked ledger account
/// and any opening-balance journals in ONE transaction. Either the whole
/// accounting event commits or none of it does (Sec 9 atomicity).
pub async fn save_with_accounting(
    pool: &SqlitePool,
    customer: &Customer,
    account: &Account,
    entries: &[JournalEntry],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    upsert_customer_tx(&mut tx, customer).await?;
    crate::repositories::account::insert_tx(&mut tx, account).await?;
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

/// Atomically persists a customer update together with its linked-account sync
/// and any balance-adjustment journal in ONE transaction (Sec 9 atomicity).
pub async fn update_with_accounting(
    pool: &SqlitePool,
    customer: &Customer,
    account: Option<&Account>,
    entries: &[JournalEntry],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    upsert_customer_tx(&mut tx, customer).await?;
    if let Some(account) = account {
        crate::repositories::account::upsert_tx(&mut tx, account).await?;
    }
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

/// Atomically deletes a customer, its linked account and the still-deletable
/// journal entries referencing it in ONE transaction (Sec 9 atomicity). Posted
/// entries are rejected by `journal_entry::delete_tx`'s immutability guard.
pub async fn delete_with_accounting(
    pool: &SqlitePool,
    id: &CustomerId,
    account_id: Option<&AccountId>,
    entry_ids: &[JournalEntryId],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for entry_id in entry_ids {
        crate::repositories::journal_entry::delete_tx(&mut tx, entry_id).await?;
    }
    if let Some(account_id) = account_id {
        crate::repositories::account::delete_tx(&mut tx, account_id).await?;
    }
    sqlx::query("DELETE FROM customers WHERE id = ?")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

async fn upsert_customer_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    customer: &Customer,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO customers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            name = excluded.name,
            phone = excluded.phone,
            address = excluded.address,
            account_id = excluded.account_id,
            debit = excluded.debit,
            credit = excluded.credit,
            opening_balance = excluded.opening_balance,
            balance = excluded.balance,
            currency = excluded.currency,
            notes = excluded.notes,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at"
    )
    .bind(customer.id.to_string())
    .bind(&customer.code)
    .bind(&customer.name)
    .bind(customer.phone.as_deref().unwrap_or(""))
    .bind(customer.address.as_deref().unwrap_or(""))
    .bind(customer.account_id.as_ref().map(|id| id.0.to_string()))
    .bind(customer.debit.to_string())
    .bind(customer.credit.to_string())
    .bind(customer.opening_balance.to_string())
    .bind(customer.balance.to_string())
    .bind(&customer.currency.code)
    .bind(&customer.notes)
    .bind(customer.is_active)
    .bind(customer.created_at.to_rfc3339())
    .bind(customer.updated_at.to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &CustomerId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM customers WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
