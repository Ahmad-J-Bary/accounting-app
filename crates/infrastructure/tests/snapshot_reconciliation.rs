use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::use_cases::journal::ReverseJournalEntryUseCase;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{SqliteAccountRepository, SqliteJournalEntryRepository};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_snapshot_reconciliation_{}.sqlite",
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
    run_migrations(&pool).await.expect("migrations");
    Arc::new(pool)
}

fn test_currency() -> Currency {
    Currency::new("IQD", "دينار عراقي", "Iraqi Dinar", "ع.د", 2, false)
}

async fn seed_account(pool: &sqlx::SqlitePool, code: &str, name: &str) -> AccountId {
    let id = AccountId::new();
    let base = test_currency();
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, category, level, opening_balance, balance, debit, credit, is_active, created_at, updated_at, currency_code, exchange_rate)
         VALUES (?, ?, ?, ?, 'Asset', 'Detail', 2, '0', '0', '0', '0', 1, datetime('now'), datetime('now'), ?, '1')",
    )
    .bind(id.0.to_string())
    .bind(code)
    .bind(name)
    .bind(name)
    .bind(&base.code)
    .execute(pool)
    .await
    .unwrap();
    id
}

fn balanced_lines(amount: Decimal, debit_account: AccountId, credit_account: AccountId) -> Vec<JournalLine> {
    let c = test_currency();
    vec![
        JournalLine::new(
            debit_account,
            MonetaryAmount::new(Money::new(amount, c.clone()), dec!(1)),
            MonetaryAmount::zero(c.clone()),
            "مدين".to_string(),
        ),
        JournalLine::new(
            credit_account,
            MonetaryAmount::zero(c.clone()),
            MonetaryAmount::new(Money::new(amount, c.clone()), dec!(1)),
            "دائن".to_string(),
        ),
    ]
}

/// After posting a journal entry, the account snapshot's debit/credit accumulators
/// must match the sum of posted journal line amounts for that account.
#[tokio::test]
async fn snapshot_debit_credit_match_journal_lines_after_post() {
    let pool = build_pool().await;
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    let cash = seed_account(pool.as_ref(), "1101", "نقد بالصندوق").await;
    let expense = seed_account(pool.as_ref(), "6101", "مصاريف إدارية").await;

    let amount = dec!(5000);
    let lines = balanced_lines(amount, expense, cash);

    let mut entry = JournalEntry::new(
        "JE-REC-001".to_string(),
        JournalType::GeneralJournal,
        lines,
        chrono::Utc::now(),
        " اختبار تطابق الحسابات".to_string(),
        None,
    )
    .expect("valid entry");

    entry.post().expect("post");

    // Save through PostJournalEntryUseCase pattern (atomic snapshot sync)
    application::use_cases::journal::snapshot_sync::save_posted_with_snapshots(
        &pool,
        &*journal_repo,
        &account_repo,
        &entry,
    )
    .await
    .expect("save_posted_with_snapshots");

    // Verify: expense account debit accumulator must equal the line debit
    let expense_account = account_repo.find_by_id(&expense).await.unwrap().unwrap();
    assert_eq!(
        expense_account.debit, amount,
        "expense account debit accumulator must match journal line debit"
    );
    assert_eq!(
        expense_account.credit,
        Decimal::ZERO,
        "expense account credit accumulator must be zero"
    );
    assert_eq!(
        expense_account.balance, amount,
        "expense account balance = opening(0) + debit - credit"
    );

    // Verify: cash account credit accumulator must equal the line credit
    let cash_account = account_repo.find_by_id(&cash).await.unwrap().unwrap();
    assert_eq!(
        cash_account.debit,
        Decimal::ZERO,
        "cash account debit accumulator must be zero"
    );
    assert_eq!(
        cash_account.credit, amount,
        "cash account credit accumulator must match journal line credit"
    );
    assert_eq!(
        cash_account.balance,
        dec!(-5000),
        "cash account balance = opening(0) + debit - credit = -5000"
    );
}

/// After posting TWO journal entries hitting the same account, the snapshot
/// accumulators must reflect the COMBINED totals.
#[tokio::test]
async fn snapshot_accumulates_across_multiple_postings() {
    let pool = build_pool().await;
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    let cash = seed_account(pool.as_ref(), "1101", "نقد").await;
    let expense = seed_account(pool.as_ref(), "6101", "مصاريف").await;

    // First posting: 3000
    let entry1 = JournalEntry::new(
        "JE-ACC-001".to_string(),
        JournalType::GeneralJournal,
        balanced_lines(dec!(3000), expense, cash),
        chrono::Utc::now(),
        "دفعة أولى".to_string(),
        None,
    )
    .expect("valid");
    let mut entry1 = entry1;
    entry1.post().expect("post");

    save_posted_with_snapshots(&pool, &*journal_repo, &account_repo, &entry1).await;

    // Second posting: 7000
    let entry2 = JournalEntry::new(
        "JE-ACC-002".to_string(),
        JournalType::GeneralJournal,
        balanced_lines(dec!(7000), expense, cash),
        chrono::Utc::now(),
        "دفعة ثانية".to_string(),
        None,
    )
    .expect("valid");
    let mut entry2 = entry2;
    entry2.post().expect("post");

    save_posted_with_snapshots(&pool, &*journal_repo, &account_repo, &entry2).await;

    // Verify accumulated totals
    let expense_account = account_repo.find_by_id(&expense).await.unwrap().unwrap();
    assert_eq!(expense_account.debit, dec!(10000), "total debit = 3000 + 7000");
    assert_eq!(expense_account.credit, Decimal::ZERO);
    assert_eq!(expense_account.balance, dec!(10000));

    let cash_account = account_repo.find_by_id(&cash).await.unwrap().unwrap();
    assert_eq!(cash_account.debit, Decimal::ZERO);
    assert_eq!(cash_account.credit, dec!(10000), "total credit = 3000 + 7000");
    assert_eq!(cash_account.balance, dec!(-10000));
}

/// After reversing a posted entry, the snapshot must reflect the reversal
/// (i.e., the original entry's deltas are undone).
#[tokio::test]
async fn snapshot_reversal_undoes_original_deltas() {
    let pool = build_pool().await;
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    let cash = seed_account(pool.as_ref(), "1101", "نقد").await;
    let expense = seed_account(pool.as_ref(), "6101", "مصاريف").await;

    // Post original: 5000
    let mut original = JournalEntry::new(
        "JE-REV-001".to_string(),
        JournalType::GeneralJournal,
        balanced_lines(dec!(5000), expense, cash),
        chrono::Utc::now(),
        "أصلي".to_string(),
        None,
    )
    .expect("valid");
    original.post().expect("post");

    save_posted_with_snapshots(&pool, &*journal_repo, &account_repo, &original).await;

    // Verify original posted
    let expense_account = account_repo.find_by_id(&expense).await.unwrap().unwrap();
    assert_eq!(expense_account.debit, dec!(5000));

    // Reverse via ReverseJournalEntryUseCase pattern
    let _reversal = ReverseJournalEntryUseCase::new(
        journal_repo.clone(),
        account_repo.clone(),
        pool.clone(),
    )
    .execute(original.id.to_string())
    .await
    .expect("reverse");

    // After reversal, the reversal entry's deltas (opposite direction) must
    // be applied to the snapshot.
    let expense_account = account_repo.find_by_id(&expense).await.unwrap().unwrap();
    // Original: debit 5000. Reversal: credit 5000. Net: debit 0.
    assert_eq!(
        expense_account.debit, dec!(5000),
        "debit still shows original posting"
    );
    assert_eq!(
        expense_account.credit, dec!(5000),
        "reversal applied credit delta"
    );
    assert_eq!(
        expense_account.balance, Decimal::ZERO,
        "net balance is zero after reversal"
    );

    let cash_account = account_repo.find_by_id(&cash).await.unwrap().unwrap();
    assert_eq!(cash_account.debit, dec!(5000), "reversal applied debit delta");
    assert_eq!(cash_account.credit, dec!(5000), "original credit");
    assert_eq!(cash_account.balance, Decimal::ZERO, "net balance is zero");
}

/// Verify that the GL aggregation (from journal lines) matches the account
/// snapshot balances after a series of postings.
#[tokio::test]
async fn gl_aggregation_matches_snapshot_balances() {
    let pool = build_pool().await;
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    let cash = seed_account(pool.as_ref(), "1101", "نقد").await;
    let receivable = seed_account(pool.as_ref(), "1201", "عملاء").await;
    let revenue = seed_account(pool.as_ref(), "4101", "إيرادات").await;

    // Post 3 entries
    let entries_data = [(dec!(10000), receivable, revenue),
        (dec!(5000), cash, revenue),
        (dec!(3000), cash, receivable)];

    let mut total_revenue_debit = dec!(0);
    let mut total_revenue_credit = dec!(0);
    let mut total_cash_debit = dec!(0);
    let mut total_cash_credit = dec!(0);
    let mut total_receivable_debit = dec!(0);
    let mut total_receivable_credit = dec!(0);

    for (i, (amount, debit_acc, credit_acc)) in entries_data.iter().enumerate() {
        let lines = balanced_lines(*amount, *debit_acc, *credit_acc);
        let mut entry = JournalEntry::new(
            format!("JE-GL-{:03}", i + 1),
            JournalType::GeneralJournal,
            lines,
            chrono::Utc::now(),
            format!("قيد {}", i + 1),
            None,
        )
        .expect("valid");
        entry.post().expect("post");

        // Track expected totals
        if *debit_acc == revenue {
            total_revenue_debit += amount;
        } else if *credit_acc == revenue {
            total_revenue_credit += amount;
        }
        if *debit_acc == cash {
            total_cash_debit += amount;
        } else if *credit_acc == cash {
            total_cash_credit += amount;
        }
        if *debit_acc == receivable {
            total_receivable_debit += amount;
        } else if *credit_acc == receivable {
            total_receivable_credit += amount;
        }

        save_posted_with_snapshots(&pool, &*journal_repo, &account_repo, &entry).await;
    }

    // Verify GL aggregation matches snapshots via direct SQL
    let gl_rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT account_id, CAST(COALESCE(SUM(CAST(debit_base AS REAL)), 0) AS TEXT) as total_debit,
                CAST(COALESCE(SUM(CAST(credit_base AS REAL)), 0) AS TEXT) as total_credit
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.status = 'Posted' AND je.reversal_of_entry_id IS NULL
         GROUP BY account_id",
    )
    .fetch_all(pool.as_ref())
    .await
    .unwrap();

    for (account_id_str, total_debit_str, total_credit_str) in &gl_rows {
        let account_id = AccountId(uuid::Uuid::parse_str(account_id_str).unwrap());
        let gl_debit = Decimal::from_str(total_debit_str).unwrap_or_default();
        let gl_credit = Decimal::from_str(total_credit_str).unwrap_or_default();

        let account = account_repo.find_by_id(&account_id).await.unwrap().unwrap();
        assert_eq!(
            account.debit, gl_debit,
            "account {} debit: snapshot {} vs GL {}",
            account.code, account.debit, gl_debit
        );
        assert_eq!(
            account.credit, gl_credit,
            "account {} credit: snapshot {} vs GL {}",
            account.code, account.credit, gl_credit
        );
    }
}

/// Verify that an account's balance = opening_balance + debit - credit
/// holds invariant across multiple postings.
#[tokio::test]
async fn balance_invariant_holds_after_multiple_postings() {
    let pool = build_pool().await;
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    let cash = seed_account(pool.as_ref(), "1101", "نقد").await;
    let expense = seed_account(pool.as_ref(), "6101", "مصاريف").await;

    // Post 5 entries of varying amounts
    let amounts = [dec!(1000), dec!(2500), dec!(750), dec!(4200), dec!(1800)];
    let mut expected_cash_credit = dec!(0);
    let mut expected_expense_debit = dec!(0);

    for (i, amount) in amounts.iter().enumerate() {
        let lines = balanced_lines(*amount, expense, cash);
        let mut entry = JournalEntry::new(
            format!("JE-INV-{:03}", i + 1),
            JournalType::GeneralJournal,
            lines,
            chrono::Utc::now(),
            format!("دفعة {}", i + 1),
            None,
        )
        .expect("valid");
        entry.post().expect("post");

        expected_cash_credit += amount;
        expected_expense_debit += amount;

        save_posted_with_snapshots(&pool, &*journal_repo, &account_repo, &entry).await;
    }

    // Verify invariant for cash (opening_balance = 0)
    let cash_account = account_repo.find_by_id(&cash).await.unwrap().unwrap();
    let expected_cash_balance = cash_account.opening_balance + cash_account.debit - cash_account.credit;
    assert_eq!(
        cash_account.balance, expected_cash_balance,
        "cash: balance = opening + debit - credit"
    );
    assert_eq!(cash_account.debit, Decimal::ZERO);
    assert_eq!(cash_account.credit, expected_cash_credit);
    assert_eq!(cash_account.balance, -expected_cash_credit);

    // Verify invariant for expense (opening_balance = 0)
    let expense_account = account_repo.find_by_id(&expense).await.unwrap().unwrap();
    let expected_expense_balance =
        expense_account.opening_balance + expense_account.debit - expense_account.credit;
    assert_eq!(
        expense_account.balance, expected_expense_balance,
        "expense: balance = opening + debit - credit"
    );
    assert_eq!(expense_account.debit, expected_expense_debit);
    assert_eq!(expense_account.credit, Decimal::ZERO);
    assert_eq!(expense_account.balance, expected_expense_debit);
}

// --- Helpers ---

async fn save_posted_with_snapshots(
    pool: &Arc<sqlx::SqlitePool>,
    journal_repo: &dyn JournalEntryRepository,
    account_repo: &Arc<dyn AccountRepository>,
    entry: &JournalEntry,
) {
    application::use_cases::journal::snapshot_sync::save_posted_with_snapshots(
        pool, journal_repo, account_repo, entry,
    )
    .await
    .expect("save_posted_with_snapshots should succeed");
}
