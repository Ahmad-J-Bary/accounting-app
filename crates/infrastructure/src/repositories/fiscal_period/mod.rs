use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use domain::accounting::fiscal_period::{FiscalPeriod, FiscalPeriodStatus};
use domain::shared::ids::FiscalPeriodId;
use chrono::{DateTime, Utc};
use std::sync::Arc;

const PERIOD_COLUMNS: &str = "id, company_id, start_date, end_date, status, closed_at, closed_by, created_at, updated_at";

type PeriodRow = (String, Option<String>, String, String, String, Option<String>, Option<String>, String, String);

fn row_to_period(row: PeriodRow) -> Result<FiscalPeriod, AppError> {
    let (id, company_id, start_date, end_date, status, closed_at, closed_by, created_at, updated_at) = row;
    let parse = |s: &str| -> Result<DateTime<Utc>, AppError> {
        DateTime::parse_from_rfc3339(s)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|e| AppError::Infrastructure(format!("fiscal_period date parse: {e}")))
    };
    let id = id
        .parse::<FiscalPeriodId>()
        .map_err(|e| AppError::Infrastructure(format!("fiscal_period id parse: {e}")))?;
    Ok(FiscalPeriod {
        id,
        company_id,
        start_date: parse(&start_date)?,
        end_date: parse(&end_date)?,
        status: FiscalPeriodStatus::from_str(&status),
        closed_at: closed_at.as_deref().map(parse).transpose()?,
        closed_by,
        created_at: parse(&created_at)?,
        updated_at: parse(&updated_at)?,
    })
}

pub struct SqliteFiscalPeriodRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteFiscalPeriodRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FiscalPeriodRepository for SqliteFiscalPeriodRepository {
    async fn create(&self, period: &FiscalPeriod) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO fiscal_periods (id, company_id, start_date, end_date, status, closed_at, closed_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(period.id.to_string())
        .bind(&period.company_id)
        .bind(period.start_date.to_rfc3339())
        .bind(period.end_date.to_rfc3339())
        .bind(period.status.as_str())
        .bind(period.closed_at.map(|d| d.to_rfc3339()))
        .bind(&period.closed_by)
        .bind(period.created_at.to_rfc3339())
        .bind(period.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &FiscalPeriodId) -> Result<Option<FiscalPeriod>, AppError> {
        let row = sqlx::query_as::<_, (String, Option<String>, String, String, String, Option<String>, Option<String>, String, String)>(
            format!("SELECT {PERIOD_COLUMNS} FROM fiscal_periods WHERE id = ?").as_str(),
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_period).transpose()
    }

    async fn list(&self) -> Result<Vec<FiscalPeriod>, AppError> {
        let rows = sqlx::query_as::<_, (String, Option<String>, String, String, String, Option<String>, Option<String>, String, String)>(
            format!("SELECT {PERIOD_COLUMNS} FROM fiscal_periods ORDER BY start_date").as_str(),
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut periods = Vec::with_capacity(rows.len());
        for row in rows {
            periods.push(row_to_period(row)?);
        }
        Ok(periods)
    }

    async fn find_by_date(&self, date: DateTime<Utc>) -> Result<Vec<FiscalPeriod>, AppError> {
        let rows = sqlx::query_as::<_, (String, Option<String>, String, String, String, Option<String>, Option<String>, String, String)>(
            format!("SELECT {PERIOD_COLUMNS} FROM fiscal_periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date").as_str(),
        )
        .bind(date.to_rfc3339())
        .bind(date.to_rfc3339())
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut periods = Vec::with_capacity(rows.len());
        for row in rows {
            periods.push(row_to_period(row)?);
        }
        Ok(periods)
    }

    async fn update(&self, period: &FiscalPeriod) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE fiscal_periods SET status = ?, closed_at = ?, closed_by = ?, updated_at = ? WHERE id = ?",
        )
        .bind(period.status.as_str())
        .bind(period.closed_at.map(|d| d.to_rfc3339()))
        .bind(&period.closed_by)
        .bind(period.updated_at.to_rfc3339())
        .bind(period.id.to_string())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}