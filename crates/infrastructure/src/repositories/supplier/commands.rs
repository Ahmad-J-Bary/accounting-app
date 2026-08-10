use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::suppliers::Supplier;
use domain::shared::ids::SupplierId;
use domain::shared::{AccountId, JournalEntryId};

pub async fn save(pool: &SqlitePool, supplier: &Supplier) -> Result<(), AppError> {
    upsert_tx_free(pool, supplier).await
}

/// Upserts a supplier row in its own transaction (used by the plain `save` /
/// `update` port methods).
async fn upsert_tx_free(pool: &SqlitePool, supplier: &Supplier) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO suppliers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at)
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
    .bind(supplier.id.to_string())
    .bind(&supplier.code)
    .bind(&supplier.name)
    .bind(supplier.phone.as_deref().unwrap_or(""))
    .bind(supplier.address.as_deref().unwrap_or(""))
    .bind(supplier.account_id.as_ref().map(|id| id.0.to_string()))
    .bind(supplier.debit.to_string())
    .bind(supplier.credit.to_string())
    .bind(supplier.opening_balance.to_string())
    .bind(supplier.balance.to_string())
    .bind(&supplier.currency.code)
    .bind(&supplier.notes)
    .bind(supplier.is_active)
    .bind(supplier.created_at.to_rfc3339())
    .bind(supplier.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically persists a new supplier together with its linked ledger account
/// and any opening-balance journals in ONE transaction (Sec 9 atomicity).
pub async fn save_with_accounting(
    pool: &SqlitePool,
    supplier: &Supplier,
    account: &Account,
    entries: &[JournalEntry],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    upsert_supplier_tx(&mut tx, supplier).await?;
    crate::repositories::account::insert_tx(&mut tx, account).await?;
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

/// Atomically persists a supplier update together with its linked-account sync
/// and any balance-adjustment journal in ONE transaction (Sec 9 atomicity).
pub async fn update_with_accounting(
    pool: &SqlitePool,
    supplier: &Supplier,
    account: Option<&Account>,
    entries: &[JournalEntry],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    upsert_supplier_tx(&mut tx, supplier).await?;
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

/// Atomically deletes a supplier, its linked account and the still-deletable
/// journal entries referencing it in ONE transaction (Sec 9 atomicity). Posted
/// entries are rejected by `journal_entry::delete_tx`'s immutability guard.
pub async fn delete_with_accounting(
    pool: &SqlitePool,
    id: &SupplierId,
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
    sqlx::query("DELETE FROM suppliers WHERE id = ?")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

async fn upsert_supplier_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    supplier: &Supplier,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO suppliers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at)
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
    .bind(supplier.id.to_string())
    .bind(&supplier.code)
    .bind(&supplier.name)
    .bind(supplier.phone.as_deref().unwrap_or(""))
    .bind(supplier.address.as_deref().unwrap_or(""))
    .bind(supplier.account_id.as_ref().map(|id| id.0.to_string()))
    .bind(supplier.debit.to_string())
    .bind(supplier.credit.to_string())
    .bind(supplier.opening_balance.to_string())
    .bind(supplier.balance.to_string())
    .bind(&supplier.currency.code)
    .bind(&supplier.notes)
    .bind(supplier.is_active)
    .bind(supplier.created_at.to_rfc3339())
    .bind(supplier.updated_at.to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &SupplierId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM suppliers WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
