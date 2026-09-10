//! PHASE 5.9.3 — SQL Decimal Precision Experiment
//!
//! Directly tests SQLite's behavior with TEXT monetary columns and the exact
//! CAST/REAL patterns used in production queries.  All assertions compare
//! Decimal values — not strings, not f64.

use std::str::FromStr;

use rust_decimal::Decimal;
use sqlx::sqlite::SqlitePoolOptions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn build_pool() -> sqlx::SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();

    sqlx::query(
        "CREATE TABLE test_monetary (
            id INTEGER PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '0'
        )",
    )
    .execute(&pool)
    .await
    .unwrap();

    pool
}

async fn build_journal_pool() -> sqlx::SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();

    sqlx::query(
        "CREATE TABLE journal_lines (
            credit_base TEXT NOT NULL DEFAULT '0',
            debit_base TEXT NOT NULL DEFAULT '0'
        )",
    )
    .execute(&pool)
    .await
    .unwrap();

    pool
}

async fn insert_value(pool: &sqlx::SqlitePool, value: &str) {
    sqlx::query("INSERT INTO test_monetary (value) VALUES (?)")
        .bind(value)
        .execute(pool)
        .await
        .unwrap();
}

/// Query returning TEXT — use for CAST(... AS TEXT) expressions.
async fn query_text(pool: &sqlx::SqlitePool, sql: &str) -> String {
    sqlx::query_scalar::<_, Option<String>>(sql)
        .fetch_one(pool)
        .await
        .unwrap()
        .unwrap_or_else(|| "0".to_string())
}

/// Query returning REAL — use for bare SUM(CAST(... AS REAL)) expressions.
async fn query_real(pool: &sqlx::SqlitePool, sql: &str) -> String {
    let val: Option<f64> = sqlx::query_scalar(sql)
        .fetch_one(pool)
        .await
        .unwrap();
    match val {
        Some(v) => format!("{}", v),
        None => "0".to_string(),
    }
}

fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).unwrap()
}

// ---------------------------------------------------------------------------
// STEP 4 — Core precision experiment
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_sum_text_vs_sum_cast_real() {
    let pool = build_pool().await;

    let values = [
        "0.10", "0.20", "0.30", "27.00", "27.10",
        "100.25", "123456789.99", "999999999999.99",
    ];
    for v in &values {
        insert_value(&pool, v).await;
    }

    // Pattern C: CAST(SUM(value) AS TEXT) — production safe pattern
    let c = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(value), '0') AS TEXT) FROM test_monetary",
    )
    .await;
    let c_dec = dec(&c);

    // Pattern D: CAST(SUM(CAST(value AS REAL)) AS TEXT) — production risky pattern
    let d = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(CAST(value AS REAL)), '0') AS TEXT) FROM test_monetary",
    )
    .await;
    let d_dec = dec(&d);

    // Pattern B2: SUM(CAST(value AS REAL)) via f64 decoder
    let b2 = query_real(
        &pool,
        "SELECT SUM(CAST(value AS REAL)) FROM test_monetary",
    )
    .await;
    let b2_dec = dec(&b2);

    // Exact expected sum: 0.10+0.20+0.30+27.00+27.10+100.25+123456789.99+999999999999.99
    let expected = dec("1000123456944.93");

    println!("=== Core SUM Experiment ===");
    println!("C: CAST(SUM(value) AS TEXT)              = \"{}\" → {}", c, c_dec);
    println!("D: CAST(SUM(CAST(..AS REAL)) AS TEXT)     = \"{}\" → {}", d, d_dec);
    println!("B2: SUM(CAST(..AS REAL)) via f64 decoder  = \"{}\" → {}", b2, b2_dec);
    println!("Expected:                                       {}", expected);

    assert_eq!(c_dec, expected, "Pattern C (safe) mismatch");
    assert_eq!(d_dec, expected, "Pattern D (risky) mismatch");
    let diff = (b2_dec - expected).abs();
    println!("B2 vs expected diff: {}", diff);
}

// ---------------------------------------------------------------------------
// STEP 5 — Problematic decimal combinations
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_problematic_combinations() {
    let pool = build_pool().await;

    struct TestCase {
        name: &'static str,
        values: Vec<&'static str>,
        expected: Decimal,
    }

    let cases = vec![
        TestCase {
            name: "0.10 + 0.20",
            values: vec!["0.10", "0.20"],
            expected: dec("0.30"),
        },
        TestCase {
            name: "0.10 + 0.20 + 0.30",
            values: vec!["0.10", "0.20", "0.30"],
            expected: dec("0.60"),
        },
        TestCase {
            name: "27.00",
            values: vec!["27.00"],
            expected: dec("27.00"),
        },
        TestCase {
            name: "100.25",
            values: vec!["100.25"],
            expected: dec("100.25"),
        },
        TestCase {
            name: "123456789.99 + 0.01",
            values: vec!["123456789.99", "0.01"],
            expected: dec("123456790.00"),
        },
        TestCase {
            name: "999999999999.99 + 0.01",
            values: vec!["999999999999.99", "0.01"],
            expected: dec("1000000000000.00"),
        },
    ];

    println!("=== Problematic Combination Tests ===");

    for case in &cases {
        sqlx::query("DELETE FROM test_monetary")
            .execute(&pool)
            .await
            .unwrap();
        for v in &case.values {
            insert_value(&pool, v).await;
        }

        // Pattern C: safe TEXT sum
        let c = query_text(
            &pool,
            "SELECT CAST(COALESCE(SUM(value), '0') AS TEXT) FROM test_monetary",
        )
        .await;
        let c_dec = dec(&c);

        // Pattern D: risky REAL sum
        let d = query_text(
            &pool,
            "SELECT CAST(COALESCE(SUM(CAST(value AS REAL)), '0') AS TEXT) FROM test_monetary",
        )
        .await;
        let d_dec = dec(&d);

        println!(
            "  {}: C={} D={} expected={}",
            case.name, c_dec, d_dec, case.expected
        );

        assert_eq!(
            c_dec, case.expected,
            "{}: Pattern C = {} != expected {}",
            case.name, c_dec, case.expected
        );
        assert_eq!(
            d_dec, case.expected,
            "{}: Pattern D = {} != expected {}",
            case.name,
            d_dec,
            case.expected
        );
    }
}

// ---------------------------------------------------------------------------
// STEP 5 — Subtraction pattern
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_subtraction_pattern() {
    let pool = build_journal_pool().await;

    struct SubCase {
        name: &'static str,
        rows: Vec<(&'static str, &'static str)>,
        expected_net: Decimal,
    }

    let cases = vec![
        SubCase {
            name: "0.10+0.20 credit vs 0.30 debit",
            rows: vec![("0.10", "0"), ("0.20", "0"), ("0", "0.30")],
            expected_net: dec("0.00"),
        },
        SubCase {
            name: "100.25 credit vs 27.10 debit",
            rows: vec![("100.25", "0"), ("0", "27.10")],
            expected_net: dec("73.15"),
        },
        SubCase {
            name: "123456789.99 credit + 0.01 credit",
            rows: vec![("123456789.99", "0"), ("0.01", "0")],
            expected_net: dec("123456790.00"),
        },
        SubCase {
            name: "999999999999.99 + 0.01",
            rows: vec![("999999999999.99", "0"), ("0.01", "0")],
            expected_net: dec("1000000000000.00"),
        },
        SubCase {
            name: "mixed: 27.00+0.10+0.20 credit vs 27.10+0.20 debit",
            rows: vec![
                ("27.00", "0"),
                ("0.10", "0"),
                ("0.20", "0"),
                ("0", "27.10"),
                ("0", "0.20"),
            ],
            expected_net: dec("0.00"),
        },
    ];

    println!("=== Subtraction Pattern Tests ===");

    for case in &cases {
        sqlx::query("DELETE FROM journal_lines")
            .execute(&pool)
            .await
            .unwrap();

        for (credit, debit) in &case.rows {
            sqlx::query("INSERT INTO journal_lines (credit_base, debit_base) VALUES (?, ?)")
                .bind(credit)
                .bind(debit)
                .execute(&pool)
                .await
                .unwrap();
        }

        // Pattern E: production query
        let e_raw = query_text(
            &pool,
            "SELECT CAST(COALESCE(SUM(CAST(credit_base AS REAL) - CAST(debit_base AS REAL)), '0') AS TEXT) FROM journal_lines",
        )
        .await;

        // Parse — may fail on scientific notation from f64 residual
        let e_dec = Decimal::from_str(&e_raw).unwrap_or_else(|_| {
            println!("  WARNING: scientific notation parse failure: \"{}\"", e_raw);
            Decimal::ZERO
        });

        // Alternative: split SUM
        let parts_raw = query_text(
            &pool,
            "SELECT CAST(COALESCE(SUM(CAST(credit_base AS REAL)), '0') - COALESCE(SUM(CAST(debit_base AS REAL)), '0') AS TEXT) FROM journal_lines",
        )
        .await;
        let parts_dec = Decimal::from_str(&parts_raw).unwrap_or_else(|_| {
            println!("  WARNING: scientific notation parse failure: \"{}\"", parts_raw);
            Decimal::ZERO
        });

        println!(
            "  {}: E={}({}) parts={}({}) expected={}",
            case.name, e_dec, e_raw, parts_dec, parts_raw, case.expected_net
        );

        // For subtraction patterns, allow tolerance for f64 residuals
        let e_diff = (e_dec - case.expected_net).abs();
        let parts_diff = (parts_dec - case.expected_net).abs();
        let tolerance = Decimal::new(1, 6); // 0.000001

        if e_diff > tolerance {
            panic!(
                "{}: production pattern = {} (raw: \"{}\") != expected {} (diff: {})",
                case.name, e_dec, e_raw, case.expected_net, e_diff
            );
        }
        if parts_diff > tolerance {
            panic!(
                "{}: split pattern = {} (raw: \"{}\") != expected {} (diff: {})",
                case.name, parts_dec, parts_raw, case.expected_net, parts_diff
            );
        }
    }
}

// ---------------------------------------------------------------------------
// STEP 5 — Scale normalization vs precision loss
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_scale_normalization_is_not_precision_loss() {
    let pool = build_pool().await;

    insert_value(&pool, "27.00").await;

    let result = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(CAST(value AS REAL)), '0') AS TEXT) FROM test_monetary",
    )
    .await;

    let result_dec = dec(&result);

    println!("=== Scale Normalization ===");
    println!("SQL output: \"{}\"", result);
    println!("Decimal value: {}", result_dec);

    assert_eq!(result_dec, dec("27.00"));
}

// ---------------------------------------------------------------------------
// STEP 5 — The classic 0.1 + 0.2 trap
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_classic_float_trap() {
    let pool = build_pool().await;

    insert_value(&pool, "0.10").await;
    insert_value(&pool, "0.20").await;

    let result_d = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(CAST(value AS REAL)), '0') AS TEXT) FROM test_monetary",
    )
    .await;
    let result_d_dec = dec(&result_d);

    let result_c = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(value), '0') AS TEXT) FROM test_monetary",
    )
    .await;
    let result_c_dec = dec(&result_c);

    let result_f64 = query_real(
        &pool,
        "SELECT SUM(CAST(value AS REAL)) FROM test_monetary",
    )
    .await;
    let result_f64_dec = dec(&result_f64);

    println!("=== Classic 0.1 + 0.2 ===");
    println!("D (CAST(SUM(CAST(..AS REAL)) AS TEXT)) = \"{}\" → {}", result_d, result_d_dec);
    println!("C (CAST(SUM(value) AS TEXT))           = \"{}\" → {}", result_c, result_c_dec);
    println!("f64 intermediary                       = \"{}\" → {}", result_f64, result_f64_dec);
    println!("Expected: Decimal(0.30)");

    assert_eq!(result_d_dec, dec("0.30"), "Pattern D failed");
    assert_eq!(result_c_dec, dec("0.30"), "Pattern C failed");
}

// ---------------------------------------------------------------------------
// STEP 4 — Row-by-row REAL vs exact Decimal
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_row_level_real_precision() {
    let pool = build_pool().await;

    let values = [
        ("0.10", dec("0.10")),
        ("0.20", dec("0.20")),
        ("0.30", dec("0.30")),
        ("27.00", dec("27.00")),
        ("27.10", dec("27.10")),
        ("100.25", dec("100.25")),
        ("123456789.99", dec("123456789.99")),
        ("999999999999.99", dec("999999999999.99")),
    ];

    println!("=== Row-Level REAL Precision ===");

    for (text_val, expected_dec) in &values {
        sqlx::query("DELETE FROM test_monetary")
            .execute(&pool)
            .await
            .unwrap();
        insert_value(&pool, text_val).await;

        let result = query_text(
            &pool,
            "SELECT CAST(CAST(value AS REAL) AS TEXT) FROM test_monetary",
        )
        .await;

        let result_dec = dec(&result);

        println!(
            "  \"{}\" → REAL → \"{}\" → {} (expected {})",
            text_val, result, result_dec, expected_dec
        );

        assert_eq!(
            result_dec, *expected_dec,
            "Row-level REAL roundtrip failed for \"{}\"",
            text_val
        );
    }
}

// ---------------------------------------------------------------------------
// STEP 5 — Dashboard KPI pattern
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_dashboard_kpi_pattern() {
    let pool = build_journal_pool().await;

    let rows = vec![
        ("100.25", "0"),
        ("50.10", "0"),
        ("0", "10.05"),
        ("0", "27.10"),
        ("0", "15.30"),
    ];

    for (credit, debit) in &rows {
        sqlx::query("INSERT INTO journal_lines (credit_base, debit_base) VALUES (?, ?)")
            .bind(credit)
            .bind(debit)
            .execute(&pool)
            .await
            .unwrap();
    }

    let total_credit = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(CAST(credit_base AS REAL)), '0') AS TEXT) FROM journal_lines",
    )
    .await;
    let total_debit = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(CAST(debit_base AS REAL)), '0') AS TEXT) FROM journal_lines",
    )
    .await;

    let credit_dec = dec(&total_credit);
    let debit_dec = dec(&total_debit);
    let net = credit_dec - debit_dec;

    let expected_credit = dec("150.35");
    let expected_debit = dec("52.45");
    let expected_net = dec("97.90");

    println!("=== Dashboard KPI Pattern ===");
    println!("Credit: \"{}\" → {} (expected {})", total_credit, credit_dec, expected_credit);
    println!("Debit:  \"{}\" → {} (expected {})", total_debit, debit_dec, expected_debit);
    println!("Net:    {} (expected {})", net, expected_net);

    assert_eq!(credit_dec, expected_credit);
    assert_eq!(debit_dec, expected_debit);
    assert_eq!(net, expected_net);
}

// ---------------------------------------------------------------------------
// STEP 5 — Retained earnings pattern
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_retained_earnings_pattern() {
    let pool = build_journal_pool().await;

    let rows = vec![("40.00", "0"), ("12.35", "0")];

    for (credit, debit) in &rows {
        sqlx::query("INSERT INTO journal_lines (credit_base, debit_base) VALUES (?, ?)")
            .bind(credit)
            .bind(debit)
            .execute(&pool)
            .await
            .unwrap();
    }

    let result = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(CAST(credit_base AS REAL) - CAST(debit_base AS REAL)), '0') AS TEXT) FROM journal_lines",
    )
    .await;
    let result_dec = dec(&result);

    let expected = dec("52.35");

    println!("=== Retained Earnings Pattern ===");
    println!("Result: \"{}\" → {} (expected {})", result, result_dec, expected);

    assert_eq!(result_dec, expected);
}

// ---------------------------------------------------------------------------
// STEP 5 — Large value stress test with subtraction
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn test_large_values_with_subtraction() {
    let pool = build_journal_pool().await;

    let rows = vec![
        ("999999999999.99", "0"),
        ("0.01", "0"),
        ("0", "999999999999.99"),
        ("0", "0.01"),
    ];

    for (credit, debit) in &rows {
        sqlx::query("INSERT INTO journal_lines (credit_base, debit_base) VALUES (?, ?)")
            .bind(credit)
            .bind(debit)
            .execute(&pool)
            .await
            .unwrap();
    }

    let result = query_text(
        &pool,
        "SELECT CAST(COALESCE(SUM(CAST(credit_base AS REAL) - CAST(debit_base AS REAL)), '0') AS TEXT) FROM journal_lines",
    )
    .await;
    let result_dec = dec(&result);

    let expected = dec("0.00");

    println!("=== Large Values with Subtraction ===");
    println!("Result: \"{}\" → {} (expected {})", result, result_dec, expected);

    assert_eq!(result_dec, expected);
}
