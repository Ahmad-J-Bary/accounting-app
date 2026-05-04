use sqlx::{SqlitePool, Row};
use std::sync::Arc;
use async_trait::async_trait;
use domain::shared::exchange_rate::{ExchangeRate, RateType};
use application::ports::exchange_rate_repository::ExchangeRateRepository;
use application::errors::AppError;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;

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
             ORDER BY rate_date DESC LIMIT 1"
        )
        .bind(from)
        .bind(to)
        .bind(rt)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(row.map(|r| ExchangeRate {
            id: r.get("id"),
            from_currency: r.get("from_currency"),
            to_currency: r.get("to_currency"),
            rate: Decimal::from_str(&r.get::<String, _>("rate")).unwrap_or(Decimal::ONE),
            rate_type: parse_rate_type(&r.get::<String, _>("rate_type")),
            rate_date: DateTime::parse_from_rfc3339(&r.get::<String, _>("rate_date")).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
            source: r.get("source"),
            user_id: None,
            created_at: DateTime::parse_from_rfc3339(&r.get::<String, _>("created_at")).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        }))
    }

    async fn find_at_date(
        &self,
        from: &str,
        to: &str,
        date: DateTime<Utc>,
        rate_type: RateType,
    ) -> Result<Option<ExchangeRate>, AppError> {
        let date_str = date.format("%Y-%m-%d").to_string();
        let rt = rate_type_to_str(&rate_type);
        let row = sqlx::query(
            "SELECT id, from_currency, to_currency, rate, rate_type, rate_date, source, created_at
             FROM exchange_rates
             WHERE from_currency = ? AND to_currency = ?
             AND rate_type = ?
             AND date(rate_date) = date(?)
             ORDER BY created_at DESC LIMIT 1"
        )
        .bind(from)
        .bind(to)
        .bind(rt)
        .bind(date_str)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(row.map(|r| ExchangeRate {
            id: r.get("id"),
            from_currency: r.get("from_currency"),
            to_currency: r.get("to_currency"),
            rate: Decimal::from_str(&r.get::<String, _>("rate")).unwrap_or(Decimal::ONE),
            rate_type: parse_rate_type(&r.get::<String, _>("rate_type")),
            rate_date: DateTime::parse_from_rfc3339(&r.get::<String, _>("rate_date")).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
            source: r.get("source"),
            user_id: None,
            created_at: DateTime::parse_from_rfc3339(&r.get::<String, _>("created_at")).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        }))
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
             LIMIT ?"
        )
        .bind(from)
        .bind(to)
        .bind(limit)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(|r| ExchangeRate {
            id: r.get("id"),
            from_currency: r.get("from_currency"),
            to_currency: r.get("to_currency"),
            rate: Decimal::from_str(&r.get::<String, _>("rate")).unwrap_or(Decimal::ONE),
            rate_type: parse_rate_type(&r.get::<String, _>("rate_type")),
            rate_date: DateTime::parse_from_rfc3339(&r.get::<String, _>("rate_date")).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
            source: r.get("source"),
            user_id: None,
            created_at: DateTime::parse_from_rfc3339(&r.get::<String, _>("created_at")).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        }).collect())
    }
}
