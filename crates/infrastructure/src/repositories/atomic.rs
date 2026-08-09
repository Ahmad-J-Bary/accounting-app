use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::customers::Customer;
use domain::inventory::stock_movement::StockMovement;
use domain::payments::Payment;
use domain::suppliers::Supplier;

/// Writes a full accounting event in ONE transaction: stock movements,
/// journal entries, an optional payment voucher and any customer / supplier /
/// account balance changes. All-or-nothing (Sec 9 atomicity).
#[allow(clippy::too_many_arguments)]
pub async fn write_event(
    pool: &SqlitePool,
    movements: &[StockMovement],
    entries: &[JournalEntry],
    payment: Option<&Payment>,
    customers: &[Customer],
    suppliers: &[Supplier],
    accounts: &[Account],
) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for movement in movements {
        crate::repositories::stock_movement::insert_movement_tx(&mut tx, movement).await?;
    }
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }
    if let Some(payment) = payment {
        insert_payment_tx(&mut tx, payment).await?;
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

async fn update_account_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    account: &Account,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE accounts SET debit = ?, credit = ?, balance = ?, updated_at = ? WHERE id = ?"
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
