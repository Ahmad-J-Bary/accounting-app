use application::errors::AppError;
use application::ports::exchange_rate_repository::ExchangeRateRepository;
use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use domain::shared::exchange_rate::{ExchangeRate, RateType};
use rust_decimal::Decimal;
use sqlx::sqlite::SqliteRow;
use sqlx::{Row, SqlitePool};
use std::str::FromStr;
use std::sync::Arc;

pub struct SqliteExchangeRateRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteExchangeRateRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

fn parse_rate_type(s: &str) -> RateType {
    match s {
        "Purchase" => RateType::Purchase,
        "Sale" => RateType::Sale,
        "Closing" => RateType::Closing,
        _ => RateType::Middle,
    }
}

fn rate_type_to_str(rt: &RateType) -> &'static str {
    match rt {
        RateType::Purchase => "Purchase",
        RateType::Sale => "Sale",
        RateType::Closing => "Closing",
        RateType::Middle => "Middle",
    }
}

fn parse_decimal_rate(raw: &str) -> Result<Decimal, AppError> {
    Decimal::from_str(raw)
        .map_err(|e| AppError::Infrastructure(format!("Invalid rate value '{}': {}", raw, e)))
}

fn row_to_exchange_rate(r: &SqliteRow) -> Result<ExchangeRate, AppError> {
    let rate_raw: String = r.get("rate");
    Ok(ExchangeRate {
        id: r.get("id"),
        from_currency: r.get("from_currency"),
        to_currency: r.get("to_currency"),
        rate: parse_decimal_rate(&rate_raw)?,
        rate_type: parse_rate_type(&r.get::<String, _>("rate_type")),
        rate_date: DateTime::parse_from_rfc3339(&r.get::<String, _>("rate_date"))
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        source: r.get("source"),
        user_id: None,
        created_at: DateTime::parse_from_rfc3339(&r.get::<String, _>("created_at"))
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

#[async_trait]
impl ExchangeRateRepository for SqliteExchangeRateRepository {
    async fn save(&self, rate: &ExchangeRate) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO exchange_rates (id, from_currency, to_currency, rate, rate_type, rate_date, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&rate.id)
        .bind(&rate.from_currency)
        .bind(&rate.to_currency)
        .bind(rate.rate.to_string())
        .bind(rate_type_to_str(&rate.rate_type))
        .bind(rate.rate_date.to_rfc3339())
        .bind(&rate.source)
        .bind(rate.created_at.to_rfc3339())
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_latest(
        &self,
        from: &str,
        to: &str,
        rate_type: RateType,
    ) -> Result<Option<ExchangeRate>, AppError> {
        let rt = rate_type_to_str(&rate_type);
        let row = sqlx::query(
            "SELECT id, from_currency, to_currency, rate, rate_type, rate_date, source, created_at
             FROM exchange_rates
             WHERE from_currency = ? AND to_currency = ? AND rate_type = ?
             ORDER BY rate_date DESC LIMIT 1",
        )
        .bind(from)
        .bind(to)
        .bind(rt)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.as_ref().map(row_to_exchange_rate).transpose()
    }

    async fn find_at_date(
        &self,
        from: &str,
        to: &str,
        date: DateTime<Utc>,
        rate_type: RateType,
    ) -> Result<Option<ExchangeRate>, AppError> {
        let start_of_day = date
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| AppError::Infrastructure("Invalid date".to_string()))?
            .and_utc();
        let end_of_day = start_of_day + Duration::days(1);

        let rt = rate_type_to_str(&rate_type);
        let row = sqlx::query(
            "SELECT id, from_currency, to_currency, rate, rate_type, rate_date, source, created_at
             FROM exchange_rates
             WHERE from_currency = ? AND to_currency = ?
             AND rate_type = ?
             AND rate_date >= ? AND rate_date < ?
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(from)
        .bind(to)
        .bind(rt)
        .bind(start_of_day.to_rfc3339())
        .bind(end_of_day.to_rfc3339())
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.as_ref().map(row_to_exchange_rate).transpose()
    }

    async fn list_history(
        &self,
        from: &str,
        to: &str,
        limit: i32,
    ) -> Result<Vec<ExchangeRate>, AppError> {
        let rows = sqlx::query(
            "SELECT id, from_currency, to_currency, rate, rate_type, rate_date, source, created_at
             FROM exchange_rates
             WHERE from_currency = ? AND to_currency = ?
             ORDER BY rate_date DESC
             LIMIT ?",
        )
        .bind(from)
        .bind(to)
        .bind(limit)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.iter().map(row_to_exchange_rate).collect()
    }
}
