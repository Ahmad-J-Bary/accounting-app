use std::str::FromStr;
use std::sync::Arc;

use application::ports::customer_repository::CustomerRepository;
use application::ports::supplier_repository::SupplierRepository;
use chrono::Utc;
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::accounting::journal_entry::{
    JournalEntry, JournalEntryStatus, JournalLine, JournalType,
};
use domain::customers::Customer;
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::suppliers::Supplier;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{SqliteCustomerRepository, SqliteSupplierRepository};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_cs_atomic_test_{}.sqlite",
        uuid::Uuid::new_v4()
    ));
    let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    let pool: Arc<sqlx::SqlitePool> = Arc::new(pool);
    run_migrations(&pool).await.unwrap();
    pool
}

/// Real seeded summary accounts the partner account hangs under: "123" A/R
/// (00000000-...-1230, level 3) and "223" A/P (00000000-...-2230, level 3).
/// Codes "1203"/"2203" were renamed to "123"/"223" in migration 015.
async fn parent_ids(pool: &sqlx::SqlitePool) -> (AccountId, AccountId) {
    let ar = sqlx::query_scalar::<_, String>("SELECT id FROM accounts WHERE code = '123' LIMIT 1")
        .fetch_one(pool)
        .await
        .unwrap();
    let ap = sqlx::query_scalar::<_, String>("SELECT id FROM accounts WHERE code = '223' LIMIT 1")
        .fetch_one(pool)
        .await
        .unwrap();
    (
        AccountId::from_str(&ar).unwrap(),
        AccountId::from_str(&ap).unwrap(),
    )
}

fn partner_account(
    code: &str,
    name: &str,
    parent_id: AccountId,
    purpose: AccountPurpose,
) -> Account {
    Account::new(
        code.to_string(),
        name.to_string(),
        name.to_string(),
        match purpose {
            AccountPurpose::Receivable => AccountType::Assets,
            _ => AccountType::Liabilities,
        },
        Some(parent_id),
        AccountCategory::Detail,
        4,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .map(|mut a| {
        a.purpose = purpose;
        a
    })
    .unwrap()
}

fn opening_entry(
    account_id: AccountId,
    partner_id: &str,
    entry_number: &str,
    amount: Decimal,
) -> JournalEntry {
    let ma = MonetaryAmount::new(Money::new(amount, test_currency()), Decimal::ONE);
    let zero = MonetaryAmount::zero(test_currency());
    let lines = vec![
        JournalLine::new(
            account_id,
            ma.clone(),
            zero.clone(),
            "رصيد افتتاحي".to_string(),
        ),
        JournalLine::new(account_id, zero, ma, "رصيد افتتاحي مقابل".to_string()),
    ];
    JournalEntry::new(
        entry_number.to_string(),
        JournalType::AccountOpeningBalance,
        lines,
        Utc::now(),
        "قيد افتتاح رصيد شريك".to_string(),
        Some(partner_id.to_string()),
    )
    .unwrap()
}

fn sample_customer(code: &str, name: &str) -> Customer {
    Customer::new(
        code.to_string(),
        name.to_string(),
        None,
        None,
        None,
        Decimal::from(500),
        Decimal::ZERO,
        Decimal::from(500),
        test_currency(),
        None,
    )
    .unwrap()
}

fn sample_supplier(code: &str, name: &str) -> Supplier {
    Supplier::new(
        code.to_string(),
        name.to_string(),
        None,
        None,
        None,
        Decimal::ZERO,
        Decimal::from(700),
        Decimal::from(700),
        test_currency(),
        None,
    )
    .unwrap()
}

#[tokio::test]
async fn customer_save_with_accounting_persists_customer_account_and_entry_atomically() {
    let pool = build_pool().await;
    let repo = SqliteCustomerRepository::new(pool.clone());
    let (ar, _) = parent_ids(&pool).await;

    let mut customer = sample_customer("1239991", "عميل اختبار ١");
    let account = partner_account("12039991", "عميل اختبار ١", ar, AccountPurpose::Receivable);
    customer.link_account(account.id);
    let entry = opening_entry(account.id, "1", "JE-ATOMIC-1", Decimal::from(500));

    repo.save_with_accounting(&customer, &account, &[entry])
        .await
        .unwrap();

    let stored = repo
        .find_by_id(&customer.id)
        .await
        .unwrap()
        .expect("customer persisted");
    assert_eq!(stored.name, "عميل اختبار ١");
    assert_eq!(stored.account_id, Some(account.id));

    let acc: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(account.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let je: i64 = sqlx::query_scalar("SELECT count(*) FROM journal_entries WHERE source_id = ?")
        .bind("1")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(acc, 1);
    assert_eq!(je, 1);
}

#[tokio::test]
async fn customer_save_with_accounting_rolls_back_everything_on_account_code_conflict() {
    let pool = build_pool().await;
    let repo = SqliteCustomerRepository::new(pool.clone());
    let (ar, _) = parent_ids(&pool).await;

    // Occupy the account code first so the composite's plain INSERT fails.
    let other = partner_account("12039992", "حساب مشغول", ar, AccountPurpose::Receivable);
    sqlx::query("INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, balance, is_active, created_at, updated_at, purpose)
                 VALUES (?, ?, ?, ?, 'Assets', ?, 'Detail', 4, '0', 1, datetime('now'), datetime('now'), 'Receivable')")
        .bind(other.id.to_string())
        .bind(&other.code)
        .bind(&other.name_ar)
        .bind(&other.name_en)
        .bind(other.parent_id.map(|id| id.to_string()))
        .execute(&*pool)
        .await
        .unwrap();

    let mut customer = sample_customer("1239993", "عميل اختبار ٢");
    let dup = partner_account("12039992", "عميل اختبار ٢", ar, AccountPurpose::Receivable);
    customer.link_account(dup.id);
    let entry = opening_entry(dup.id, "2", "JE-ATOMIC-2", Decimal::from(500));

    let err = repo.save_with_accounting(&customer, &dup, &[entry]).await;
    assert!(err.is_err(), "العملية يجب أن تفشل عند تضارب كود الحساب");

    let cust: i64 = sqlx::query_scalar("SELECT count(*) FROM customers WHERE id = ?")
        .bind(customer.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let acc: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(dup.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let je: i64 = sqlx::query_scalar("SELECT count(*) FROM journal_entries WHERE source_id = ?")
        .bind("2")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(cust, 0, "العميل يجب ألا يبقى جزئياً");
    assert_eq!(acc, 0, "الحساب يجب ألا يبقى جزئياً");
    assert_eq!(je, 0, "القيد يجب ألا يبقى جزئياً");
}

#[tokio::test]
async fn customer_delete_with_accounting_rejects_posted_entries_and_rolls_back() {
    let pool = build_pool().await;
    let repo = SqliteCustomerRepository::new(pool.clone());
    let (ar, _) = parent_ids(&pool).await;

    let mut customer = sample_customer("1239995", "عميل اختبار ٣");
    let account = partner_account("12039995", "عميل اختبار ٣", ar, AccountPurpose::Receivable);
    customer.link_account(account.id);

    // A posted entry must block deletion (immutability guard inside delete_tx).
    let mut posted_entry = opening_entry(account.id, "3", "JE-ATOMIC-3", Decimal::from(500));
    posted_entry.status = JournalEntryStatus::Posted;
    repo.save_with_accounting(&customer, &account, &[posted_entry])
        .await
        .unwrap();

    let d_ids =
        sqlx::query_scalar::<_, String>("SELECT id FROM journal_entries WHERE source_id = ?")
            .bind("3")
            .fetch_all(&*pool)
            .await
            .unwrap();
    let entry_ids = d_ids
        .iter()
        .map(|s| domain::shared::ids::JournalEntryId::from_str(s).unwrap())
        .collect::<Vec<_>>();

    let err = repo
        .delete_with_accounting(&customer.id, Some(&account.id), &entry_ids)
        .await;
    assert!(err.is_err(), "حذف قيد مرحل يجب أن يرفض");

    // Atomicity: customer + account + posted entry must survive the failed delete.
    let cust: i64 = sqlx::query_scalar("SELECT count(*) FROM customers WHERE id = ?")
        .bind(customer.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let acc: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(account.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let je: i64 = sqlx::query_scalar("SELECT count(*) FROM journal_entries WHERE source_id = ?")
        .bind("3")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(cust, 1, "فشل الحذف يجب ألا يسحب العميل");
    assert_eq!(acc, 1, "فشل الحذف يجب ألا يسحب الحساب");
    assert_eq!(je, 1, "فشل الحذف يجب ألا يسحب القيد المرحل");
}

#[tokio::test]
async fn customer_delete_with_accounting_removes_drafts_atomically() {
    let pool = build_pool().await;
    let repo = SqliteCustomerRepository::new(pool.clone());
    let (ar, _) = parent_ids(&pool).await;

    let mut c2 = sample_customer("1239996", "عميل اختبار ٤");
    let acc2 = partner_account("12039996", "عميل اختبار ٤", ar, AccountPurpose::Receivable);
    c2.link_account(acc2.id);
    let draft_entry = opening_entry(acc2.id, "4", "JE-ATOMIC-4", Decimal::from(500));
    repo.save_with_accounting(&c2, &acc2, &[draft_entry])
        .await
        .unwrap();

    let d_ids =
        sqlx::query_scalar::<_, String>("SELECT id FROM journal_entries WHERE source_id = ?")
            .bind("4")
            .fetch_all(&*pool)
            .await
            .unwrap();
    let d_entry_ids = d_ids
        .iter()
        .map(|s| domain::shared::ids::JournalEntryId::from_str(s).unwrap())
        .collect::<Vec<_>>();

    repo.delete_with_accounting(&c2.id, Some(&acc2.id), &d_entry_ids)
        .await
        .unwrap();

    let c2_rows: i64 = sqlx::query_scalar("SELECT count(*) FROM customers WHERE id = ?")
        .bind(c2.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let a2_rows: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(acc2.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let j2_rows: i64 =
        sqlx::query_scalar("SELECT count(*) FROM journal_entries WHERE source_id = ?")
            .bind("4")
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(c2_rows, 0, "العميل يجب أن يحذف نهائياً");
    assert_eq!(a2_rows, 0, "حساب العميل يجب أن يحذف معه");
    assert_eq!(j2_rows, 0, "قيد العميل المسودة يجب أن يحذف معه");
}

#[tokio::test]
async fn supplier_save_with_accounting_persists_atomically_and_rolls_back_on_conflict() {
    let pool = build_pool().await;
    let repo = SqliteSupplierRepository::new(pool.clone());
    let (_, ap) = parent_ids(&pool).await;

    // Happy path.
    let mut supplier = sample_supplier("2239991", "مورد اختبار ١");
    let account = partner_account("22039991", "مورد اختبار ١", ap, AccountPurpose::Payable);
    supplier.link_account(account.id);
    let entry = opening_entry(account.id, "5", "JE-ATOMIC-5", Decimal::from(700));

    repo.save_with_accounting(&supplier, &account, &[entry])
        .await
        .unwrap();
    let stored = repo
        .find_by_id(&supplier.id)
        .await
        .unwrap()
        .expect("supplier persisted");
    assert_eq!(stored.account_id, Some(account.id));

    // Conflict: occupy the account code and confirm full rollback.
    let other = partner_account("22039992", "حساب مشغول", ap, AccountPurpose::Payable);
    sqlx::query("INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, balance, is_active, created_at, updated_at, purpose)
                 VALUES (?, ?, ?, ?, 'Liabilities', ?, 'Detail', 4, '0', 1, datetime('now'), datetime('now'), 'Payable')")
        .bind(other.id.to_string())
        .bind(&other.code)
        .bind(&other.name_ar)
        .bind(&other.name_en)
        .bind(other.parent_id.map(|id| id.to_string()))
        .execute(&*pool)
        .await
        .unwrap();

    let mut supplier2 = sample_supplier("2239992", "مورد اختبار ٢");
    let dup = partner_account("22039992", "مورد اختبار ٢", ap, AccountPurpose::Payable);
    supplier2.link_account(dup.id);
    let dup_entry = opening_entry(dup.id, "6", "JE-ATOMIC-6", Decimal::from(700));

    let err = repo
        .save_with_accounting(&supplier2, &dup, &[dup_entry])
        .await;
    assert!(err.is_err(), "العملية يجب أن تفشل عند تضارب كود الحساب");

    let sup: i64 = sqlx::query_scalar("SELECT count(*) FROM suppliers WHERE id = ?")
        .bind(supplier2.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let acc: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(dup.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let je: i64 = sqlx::query_scalar("SELECT count(*) FROM journal_entries WHERE source_id = ?")
        .bind("6")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(sup, 0, "المورد يجب ألا يبقى جزئياً");
    assert_eq!(acc, 0, "حساب المورد يجب ألا يبقى جزئياً");
    assert_eq!(je, 0, "قيد المورد يجب ألا يبقى جزئياً");
}

#[tokio::test]
async fn supplier_delete_with_accounting_removes_customer_proof_variant() {
    // Mirrors the customer delete test but for suppliers (draft drain).
    let pool = build_pool().await;
    let repo = SqliteSupplierRepository::new(pool.clone());
    let (_, ap) = parent_ids(&pool).await;

    let mut supplier = sample_supplier("2239995", "مورد اختبار ٣");
    let account = partner_account("22039995", "مورد اختبار ٣", ap, AccountPurpose::Payable);
    supplier.link_account(account.id);
    let draft = opening_entry(account.id, "7", "JE-ATOMIC-7", Decimal::from(700));
    repo.save_with_accounting(&supplier, &account, &[draft])
        .await
        .unwrap();

    let d_ids =
        sqlx::query_scalar::<_, String>("SELECT id FROM journal_entries WHERE source_id = ?")
            .bind("7")
            .fetch_all(&*pool)
            .await
            .unwrap();
    let d_entry_ids = d_ids
        .iter()
        .map(|s| domain::shared::ids::JournalEntryId::from_str(s).unwrap())
        .collect::<Vec<_>>();

    repo.delete_with_accounting(&supplier.id, Some(&account.id), &d_entry_ids)
        .await
        .unwrap();

    let sup: i64 = sqlx::query_scalar("SELECT count(*) FROM suppliers WHERE id = ?")
        .bind(supplier.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let acc: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(account.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(sup, 0, "المورد يجب أن يحذف نهائياً");
    assert_eq!(acc, 0, "حساب المورد يجب أن يحذف معه");
}
