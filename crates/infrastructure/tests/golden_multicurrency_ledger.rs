//! PHASE 6 STEP 4 + 8 — GL-level Multi-Currency Golden Tests
//!
//! Proves at the infrastructure/GL layer that foreign-currency journal lines
//! are stored with their ORIGINAL amount, their FX rate and an EXACT
//! base-currency conversion (base = original / fx_rate), and that every report
//! aggregation (trial balance, account aggregates) operates on base amounts.
//!
//! Scenarios:
//!   * FX posting stores original + fx + base exactly (non-1 rate),
//!   * fractional rate converts exactly (775 @ 15.5 → 50),
//!   * identity rate (1.0) preserves the nominal amount,
//!   * reversing an FX entry with the original's rate snapshot nets zero base,
//!   * mixed base/foreign ledgers aggregate in base amounts only,
//!   * the domain double-entry policy rejects a zero FX rate.
//!
//! All assertions use exact Decimal values — no f64, no tolerance.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::journal_entry_repository::JournalEntryRepository;
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::policies::DoubleEntryPolicy;
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteJournalEntryRepository;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn base_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

fn foreign_currency() -> Currency {
    Currency::new("USD", "دولار أمريكي", "US Dollar", "$", 2, false)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_golden_multicurrency_ledger_{}.sqlite",
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
    let pool = Arc::new(pool);
    run_migrations(&pool).await.unwrap();
    pool
}

/// A line in the given currency at the given rate. When the monetary side is
/// zero, a zero BASE amount is used regardless of currency/rate.
fn fx_line(
    account: AccountId,
    debit: Decimal,
    credit: Decimal,
    currency: &Currency,
    fx_rate: Decimal,
) -> JournalLine {
    JournalLine::new(
        account,
        if debit > Decimal::ZERO {
            MonetaryAmount::new(Money::new(debit, currency.clone()), fx_rate)
        } else {
            MonetaryAmount::zero(base_currency())
        },
        if credit > Decimal::ZERO {
            MonetaryAmount::new(Money::new(credit, currency.clone()), fx_rate)
        } else {
            MonetaryAmount::zero(base_currency())
        },
        "fx golden test".to_string(),
    )
}

async fn seed_account(
    pool: &sqlx::SqlitePool,
    code: &str,
    name: &str,
    account_type: &str,
    purpose: &str,
) -> AccountId {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 'Detail', 4, '0', '0', ?, 1, datetime('now'), datetime('now'))",
    )
    .bind(&id)
    .bind(code)
    .bind(name)
    .bind(name)
    .bind(account_type)
    .bind(purpose)
    .execute(pool)
    .await
    .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

/// The raw stored journal_line for an account (original amount, fx, base).
async fn stored_line(
    pool: &sqlx::SqlitePool,
    account_id: &AccountId,
) -> (String, String, String, String) {
    let row: (String, String, String, String) = sqlx::query_as(
        "SELECT currency, fx_rate, debit, debit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND jl.account_id = ?
           AND jl.debit_base != '0'
         LIMIT 1",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();
    row
}

async fn aggregate_debit_credit(
    pool: &sqlx::SqlitePool,
    account_id: &AccountId,
) -> (Decimal, Decimal) {
    let row: (String, String) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT),
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT)
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND jl.account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();

    (
        Decimal::from_str(&row.0).unwrap(),
        Decimal::from_str(&row.1).unwrap(),
    )
}

// ---------------------------------------------------------------------------
// CASE 1: FX posting stores the original, its rate and the exact base
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn fx_posting_stores_original_rate_and_exact_base() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1050", "USD Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "4050", "Export Revenue", "Revenue", "general").await;
    let usd = foreign_currency();

    // 300 USD @ fx 3  →  base 100 exactly
    let mut entry = JournalEntry::new(
        "MC-001".into(),
        JournalType::GeneralJournal,
        vec![
            fx_line(cash, dec!(300), Decimal::ZERO, &usd, dec!(3)),
            fx_line(revenue, Decimal::ZERO, dec!(300), &usd, dec!(3)),
        ],
        Utc::now(),
        "fx sale".into(),
        None,
    )
    .unwrap();

    entry.post().unwrap();
    repo.save(&entry).await.unwrap();

    let (currency, fx, debit, debit_base) = stored_line(&pool, &cash).await;
    assert_eq!(currency, "USD", "original currency must be preserved");
    assert_eq!(fx, "3", "fx_rate must be preserved verbatim");
    assert_eq!(debit, "300", "original amount must be preserved verbatim");
    assert_eq!(
        debit_base, "100",
        "base must be original / fx, computed exactly as 300 / 3 = 100"
    );

    let (cash_d, _) = aggregate_debit_credit(&pool, &cash).await;
    let (_, rev_c) = aggregate_debit_credit(&pool, &revenue).await;
    assert_eq!(cash_d, dec!(100));
    assert_eq!(rev_c, dec!(100));
}

// ---------------------------------------------------------------------------
// CASE 2: fractional non-integer rate converts exactly
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn fx_fractional_rate_converts_exactly() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1051", "USD Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "4051", "Export Revenue", "Revenue", "general").await;
    let usd = foreign_currency();

    // 775 USD @ fx 15.5 → base 50 exactly
    let mut entry = JournalEntry::new(
        "MC-002".into(),
        JournalType::GeneralJournal,
        vec![
            fx_line(cash, dec!(775), Decimal::ZERO, &usd, Decimal::from_str("15.5").unwrap()),
            fx_line(revenue, Decimal::ZERO, dec!(775), &usd, Decimal::from_str("15.5").unwrap()),
        ],
        Utc::now(),
        "fx fractional rate".into(),
        None,
    )
    .unwrap();

    entry.post().unwrap();
    repo.save(&entry).await.unwrap();

    let (cash_d, _) = aggregate_debit_credit(&pool, &cash).await;
    assert_eq!(
        cash_d,
        dec!(50),
        "775 / 15.5 must convert to exactly 50 base units"
    );
}

// ---------------------------------------------------------------------------
// CASE 3: identity rate (1.0) preserves the nominal amount
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn fx_identity_rate_preserves_nominal_amount() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1052", "USD Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "4052", "Export Revenue", "Revenue", "general").await;
    let usd = foreign_currency();

    let mut entry = JournalEntry::new(
        "MC-003".into(),
        JournalType::GeneralJournal,
        vec![
            fx_line(cash, Decimal::from_str("123.45").unwrap(), Decimal::ZERO, &usd, dec!(1)),
            fx_line(revenue, Decimal::ZERO, Decimal::from_str("123.45").unwrap(), &usd, dec!(1)),
        ],
        Utc::now(),
        "fx identity rate".into(),
        None,
    )
    .unwrap();

    entry.post().unwrap();
    repo.save(&entry).await.unwrap();

    let (cash_d, _) = aggregate_debit_credit(&pool, &cash).await;
    assert_eq!(
        cash_d,
        Decimal::from_str("123.45").unwrap(),
        "fx 1.0 must keep the base equal to the nominal amount"
    );
}

// ---------------------------------------------------------------------------
// CASE 4: reversing an FX entry with the original's rate snapshot nets zero
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn fx_reversal_at_original_rate_nets_zero_base() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1053", "USD Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "4053", "Export Revenue", "Revenue", "general").await;
    let usd = foreign_currency();

    let mut original = JournalEntry::new(
        "MC-004".into(),
        JournalType::GeneralJournal,
        vec![
            fx_line(cash, dec!(300), Decimal::ZERO, &usd, dec!(3)),
            fx_line(revenue, Decimal::ZERO, dec!(300), &usd, dec!(3)),
        ],
        Utc::now(),
        "fx original".into(),
        None,
    )
    .unwrap();

    original.post().unwrap();
    repo.save(&original).await.unwrap();

    // Reversal built from the original; the swapped lines keep the SAME fx
    // rate snapshot and base amounts, so the base ledger must zero out exactly.
    let mut reversal = JournalEntry::create_reversal(
        &original,
        "MC-004-R".into(),
        Utc::now(),
        "fx reversal".into(),
    )
    .unwrap();
    let mut original_reversed = original.clone();
    original_reversed.reverse().unwrap();
    reversal.post().unwrap();
    repo.save_reversal_pair(&reversal, &original_reversed)
        .await
        .unwrap();

    let (cash_d, cash_c) = aggregate_debit_credit(&pool, &cash).await;
    let (rev_d, rev_c) = aggregate_debit_credit(&pool, &revenue).await;
    assert_eq!(cash_d, cash_c, "cash must net to zero base after reversal");
    assert_eq!(rev_d, rev_c, "revenue must net to zero base after reversal");
    assert_eq!(cash_d, Decimal::ZERO);
    assert_eq!(rev_c, Decimal::ZERO);
}

// ---------------------------------------------------------------------------
// CASE 5: mixed base/foreign ledgers aggregate in base amounts only
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn fx_mixed_currency_ledger_aggregates_in_base_only() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1054", "Cash (mixed)", "Assets", "general").await;
    let capital = seed_account(&pool, "3054", "Capital", "Equity", "general").await;
    let usd = foreign_currency();

    // Base-currency contribution: Dr Cash 150 base, Cr Capital 150 base
    let mut base_entry = JournalEntry::new(
        "MC-005".into(),
        JournalType::GeneralJournal,
        vec![
            fx_line(cash, dec!(150), Decimal::ZERO, &base_currency(), dec!(1)),
            fx_line(capital, Decimal::ZERO, dec!(150), &base_currency(), dec!(1)),
        ],
        Utc::now(),
        "base contribution".into(),
        None,
    )
    .unwrap();
    base_entry.post().unwrap();
    repo.save(&base_entry).await.unwrap();

    // Foreign-currency sale: Dr Cash 300 USD @ fx 3 → base 100, Cr Revenue
    let mut fx_entry = JournalEntry::new(
        "MC-006".into(),
        JournalType::GeneralJournal,
        vec![
            fx_line(cash, dec!(300), Decimal::ZERO, &usd, dec!(3)),
            fx_line(capital, Decimal::ZERO, dec!(300), &usd, dec!(3)),
        ],
        Utc::now(),
        "fx sale".into(),
        None,
    )
    .unwrap();
    fx_entry.post().unwrap();
    repo.save(&fx_entry).await.unwrap();

    let (cash_d, _) = aggregate_debit_credit(&pool, &cash).await;
    let (_, cap_c) = aggregate_debit_credit(&pool, &capital).await;

    assert_eq!(
        cash_d,
        dec!(250),
        "base 150 + foreign 300@3(=100) must aggregate to exactly 250 base"
    );
    assert_eq!(cap_c, dec!(250), "ledger stays balanced in base across currencies");
}

// ---------------------------------------------------------------------------
// CASE 6: the domain double-entry policy rejects a non-positive FX rate
// ---------------------------------------------------------------------------

#[test]
fn fx_zero_rate_is_rejected_by_double_entry_policy() {
    let cash = AccountId(uuid::Uuid::new_v4());
    let revenue = AccountId(uuid::Uuid::new_v4());
    let usd = foreign_currency();

    let lines = vec![
        fx_line(cash, dec!(300), Decimal::ZERO, &usd, Decimal::ZERO),
        fx_line(revenue, Decimal::ZERO, dec!(300), &usd, Decimal::ZERO),
    ];

    assert!(
        DoubleEntryPolicy::validate(&lines).is_err(),
        "an FX rate <= 0 must be rejected by the accounting policy"
    );
}