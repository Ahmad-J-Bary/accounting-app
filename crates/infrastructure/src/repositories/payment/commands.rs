use application::errors::AppError;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::customers::Customer;
use domain::payments::Payment;
use domain::shared::ids::{JournalEntryId, PaymentId};
use domain::suppliers::Supplier;
use sqlx::SqlitePool;

pub async fn save(pool: &SqlitePool, payment: &Payment) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO payments (id, voucher_number, payment_type, amount, currency_code, exchange_rate, payment_date, debit_account_id, credit_account_id, journal_entry_number, customer_id, supplier_id, reference, notes, invoice_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            voucher_number = excluded.voucher_number,
            payment_type = excluded.payment_type,
            amount = excluded.amount,
            currency_code = excluded.currency_code,
            exchange_rate = excluded.exchange_rate,
            payment_date = excluded.payment_date,
            debit_account_id = excluded.debit_account_id,
            credit_account_id = excluded.credit_account_id,
            journal_entry_number = excluded.journal_entry_number,
            customer_id = excluded.customer_id,
            supplier_id = excluded.supplier_id,
            reference = excluded.reference,
            notes = excluded.notes,
            invoice_id = excluded.invoice_id,
            updated_at = excluded.updated_at"
    )
    .bind(payment.id.to_string())
    .bind(payment.voucher_number.as_str())
    .bind(format!("{:?}", payment.payment_type))
    .bind(payment.amount.to_string())
    .bind(payment.currency_code.as_str())
    .bind(payment.exchange_rate.to_string())
    .bind(payment.payment_date.to_rfc3339())
    .bind(payment.debit_account_id.as_ref().map(|a| a.to_string()))
    .bind(payment.credit_account_id.as_ref().map(|a| a.to_string()))
    .bind(payment.journal_entry_number.as_deref())
    .bind(payment.customer_id.as_ref().map(|c| c.to_string()))
    .bind(payment.supplier_id.as_ref().map(|s| s.to_string()))
    .bind(&payment.reference)
    .bind(&payment.notes)
    .bind(&payment.invoice_id)
    .bind(payment.created_at.to_rfc3339())
    .bind(payment.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically persists a settlement in ONE transaction: the generated journal,
/// the payment voucher and the counter-party (customer/supplier) balance
/// change. Any failure rolls back the whole accounting event so a partial
/// settlement can never be committed (Sec 9 atomicity).
pub async fn save_settlement(
    pool: &SqlitePool,
    payment: &Payment,
    entry: &domain::accounting::journal_entry::JournalEntry,
    customer: Option<&Customer>,
    supplier: Option<&Supplier>,
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    insert_payment_tx(&mut tx, payment).await?;
    if let Some(customer) = customer {
        update_customer_tx(&mut tx, customer).await?;
    }
    if let Some(supplier) = supplier {
        update_supplier_tx(&mut tx, supplier).await?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

async fn insert_payment_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    payment: &Payment,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO payments (id, voucher_number, payment_type, amount, currency_code, exchange_rate, payment_date, debit_account_id, credit_account_id, journal_entry_number, customer_id, supplier_id, reference, notes, invoice_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(payment.id.to_string())
    .bind(payment.voucher_number.as_str())
    .bind(format!("{:?}", payment.payment_type))
    .bind(payment.amount.to_string())
    .bind(payment.currency_code.as_str())
    .bind(payment.exchange_rate.to_string())
    .bind(payment.payment_date.to_rfc3339())
    .bind(payment.debit_account_id.as_ref().map(|a| a.to_string()))
    .bind(payment.credit_account_id.as_ref().map(|a| a.to_string()))
    .bind(payment.journal_entry_number.as_deref())
    .bind(payment.customer_id.as_ref().map(|c| c.to_string()))
    .bind(payment.supplier_id.as_ref().map(|s| s.to_string()))
    .bind(&payment.reference)
    .bind(&payment.notes)
    .bind(&payment.invoice_id)
    .bind(payment.created_at.to_rfc3339())
    .bind(payment.updated_at.to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn update_customer_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    customer: &Customer,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE customers SET debit = ?, credit = ?, balance = ?, opening_balance = ?, updated_at = ? WHERE id = ?"
    )
    .bind(customer.debit.to_string())
    .bind(customer.credit.to_string())
    .bind(customer.balance.to_string())
    .bind(customer.opening_balance.to_string())
    .bind(customer.updated_at.to_rfc3339())
    .bind(customer.id.to_string())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn update_supplier_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    supplier: &Supplier,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE suppliers SET debit = ?, credit = ?, balance = ?, opening_balance = ?, updated_at = ? WHERE id = ?"
    )
    .bind(supplier.debit.to_string())
    .bind(supplier.credit.to_string())
    .bind(supplier.balance.to_string())
    .bind(supplier.opening_balance.to_string())
    .bind(supplier.updated_at.to_rfc3339())
    .bind(supplier.id.to_string())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &PaymentId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM payments WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// One-transaction upsert for an entire accounting event: journal entry (+
/// optional prior drafts to remove), the payment voucher, and every affected
/// customer / supplier / account balance change. All-or-nothing (Sec 9).
#[allow(clippy::too_many_arguments)]
pub async fn save_with_accounting(
    pool: &SqlitePool,
    payment: &Payment,
    entry: Option<&JournalEntry>,
    delete_entries: &[JournalEntryId],
    customers: &[Customer],
    suppliers: &[Supplier],
    accounts: &[Account],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for id in delete_entries {
        sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        sqlx::query("DELETE FROM journal_entries WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }

    if let Some(entry) = entry {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }
    insert_payment_tx(&mut tx, payment).await?;
    for customer in customers {
        update_customer_tx(&mut tx, customer).await?;
    }
    for supplier in suppliers {
        update_supplier_tx(&mut tx, supplier).await?;
    }
    for account in accounts {
        update_account_tx(&mut tx, account).await?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

/// One-transaction deletion of a payment and its journal trail: reverses the
/// affected customer / supplier / account balances and removes the payment
/// plus any still-deletable journal entries. All-or-nothing (Sec 9).
pub async fn delete_with_accounting(
    pool: &SqlitePool,
    payment_id: &PaymentId,
    delete_entries: &[JournalEntryId],
    customers: &[Customer],
    suppliers: &[Supplier],
    accounts: &[Account],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for id in delete_entries {
        let status: Option<String> =
            sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
                .bind(id.0.to_string())
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        if let Some(status) = status.as_deref() {
            if status == "Posted" || status == "Reversed" || status == "Cancelled" {
                return Err(AppError::Forbidden(
                    "لا يمكن حذف قيد مرحَّل أو ملغى؛ استخدم قيد التراجع (Reversal)".into(),
                ));
            }
        }
        sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        sqlx::query("DELETE FROM journal_entries WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }

    for customer in customers {
        update_customer_tx(&mut tx, customer).await?;
    }
    for supplier in suppliers {
        update_supplier_tx(&mut tx, supplier).await?;
    }
    for account in accounts {
        update_account_tx(&mut tx, account).await?;
    }
    sqlx::query("DELETE FROM payments WHERE id = ?")
        .bind(payment_id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

async fn update_account_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    account: &Account,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE accounts SET debit = ?, credit = ?, balance = ?, updated_at = ? WHERE id = ?",
    )
    .bind(account.debit.to_string())
    .bind(account.credit.to_string())
    .bind(account.balance.to_string())
    .bind(account.updated_at.to_rfc3339())
    .bind(account.id.0.to_string())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
