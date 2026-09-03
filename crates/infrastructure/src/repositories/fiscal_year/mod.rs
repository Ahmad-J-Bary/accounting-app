use std::sync::Arc;

use application::errors::AppError;
use application::ports::fiscal_year_repository::FiscalYearRepository;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::accounting::fiscal_year::{
    FiscalYear, FiscalYearCloseRun, FiscalYearCloseRunStatus, FiscalYearStatus,
};
use domain::shared::ids::FiscalYearId;
use sqlx::{FromRow, SqlitePool};

const FISCAL_YEAR_COLUMNS: &str = "id, company_id, label, start_date, end_date, status, previous_fiscal_year_id, closing_period_id, retained_earnings_entry_id, carry_forward_entry_id, last_close_operation_key, closed_at, closed_by, locked_at, locked_by, created_at, updated_at";
const CLOSE_RUN_COLUMNS: &str = "fiscal_year_id, operation_key, actor_id, status, closing_period_id, retained_earnings_entry_id, carry_forward_entry_id, error_message, started_at, completed_at, updated_at";

#[derive(Debug, FromRow)]
struct FiscalYearRow {
    id: String,
    company_id: Option<String>,
    label: String,
    start_date: String,
    end_date: String,
    status: String,
    previous_fiscal_year_id: Option<String>,
    closing_period_id: Option<String>,
    retained_earnings_entry_id: Option<String>,
    carry_forward_entry_id: Option<String>,
    last_close_operation_key: Option<String>,
    closed_at: Option<String>,
    closed_by: Option<String>,
    locked_at: Option<String>,
    locked_by: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, FromRow)]
struct CloseRunRow {
    fiscal_year_id: String,
    operation_key: String,
    actor_id: String,
    status: String,
    closing_period_id: Option<String>,
    retained_earnings_entry_id: Option<String>,
    carry_forward_entry_id: Option<String>,
    error_message: Option<String>,
    started_at: String,
    completed_at: Option<String>,
    updated_at: String,
}

pub struct SqliteFiscalYearRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteFiscalYearRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

fn parse_date(value: &str) -> Result<DateTime<Utc>, AppError> {
    DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&Utc))
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year date parse: {e}")))
}

fn parse_optional_id<T>(value: Option<String>, label: &str) -> Result<Option<T>, AppError>
where
    T: std::str::FromStr,
    <T as std::str::FromStr>::Err: std::fmt::Display,
{
    value
        .map(|raw| {
            raw.parse::<T>()
                .map_err(|e| AppError::Infrastructure(format!("{label} parse: {e}")))
        })
        .transpose()
}

fn row_to_fiscal_year(row: FiscalYearRow) -> Result<FiscalYear, AppError> {
    Ok(FiscalYear {
        id: row
            .id
            .parse::<FiscalYearId>()
            .map_err(|e| AppError::Infrastructure(format!("fiscal_year id parse: {e}")))?,
        company_id: row.company_id,
        label: row.label,
        start_date: parse_date(&row.start_date)?,
        end_date: parse_date(&row.end_date)?,
        status: FiscalYearStatus::from_str(&row.status),
        previous_fiscal_year_id: parse_optional_id(
            row.previous_fiscal_year_id,
            "previous_fiscal_year_id",
        )?,
        closing_period_id: parse_optional_id(row.closing_period_id, "closing_period_id")?,
        retained_earnings_entry_id: parse_optional_id(
            row.retained_earnings_entry_id,
            "retained_earnings_entry_id",
        )?,
        carry_forward_entry_id: parse_optional_id(row.carry_forward_entry_id, "carry_forward_entry_id")?,
        last_close_operation_key: row.last_close_operation_key,
        closed_at: row.closed_at.as_deref().map(parse_date).transpose()?,
        closed_by: row.closed_by,
        locked_at: row.locked_at.as_deref().map(parse_date).transpose()?,
        locked_by: row.locked_by,
        created_at: parse_date(&row.created_at)?,
        updated_at: parse_date(&row.updated_at)?,
    })
}

fn row_to_close_run(row: CloseRunRow) -> Result<FiscalYearCloseRun, AppError> {
    Ok(FiscalYearCloseRun {
        fiscal_year_id: row
            .fiscal_year_id
            .parse::<FiscalYearId>()
            .map_err(|e| AppError::Infrastructure(format!("close_run fiscal_year_id parse: {e}")))?,
        operation_key: row.operation_key,
        actor_id: row.actor_id,
        status: FiscalYearCloseRunStatus::from_str(&row.status),
        closing_period_id: parse_optional_id(
            row.closing_period_id,
            "close_run closing_period_id",
        )?,
        retained_earnings_entry_id: parse_optional_id(
            row.retained_earnings_entry_id,
            "close_run retained_earnings_entry_id",
        )?,
        carry_forward_entry_id: parse_optional_id(
            row.carry_forward_entry_id,
            "close_run carry_forward_entry_id",
        )?,
        error_message: row.error_message,
        started_at: parse_date(&row.started_at)?,
        completed_at: row.completed_at.as_deref().map(parse_date).transpose()?,
        updated_at: parse_date(&row.updated_at)?,
    })
}

#[async_trait]
impl FiscalYearRepository for SqliteFiscalYearRepository {
    async fn create(&self, fiscal_year: &FiscalYear) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO fiscal_years (
                id, company_id, label, start_date, end_date, status,
                previous_fiscal_year_id, closing_period_id, retained_earnings_entry_id,
                carry_forward_entry_id, last_close_operation_key, closed_at, closed_by,
                locked_at, locked_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(fiscal_year.id.to_string())
        .bind(&fiscal_year.company_id)
        .bind(&fiscal_year.label)
        .bind(fiscal_year.start_date.to_rfc3339())
        .bind(fiscal_year.end_date.to_rfc3339())
        .bind(fiscal_year.status.as_str())
        .bind(fiscal_year.previous_fiscal_year_id.map(|value| value.to_string()))
        .bind(fiscal_year.closing_period_id.map(|value| value.to_string()))
        .bind(
            fiscal_year
                .retained_earnings_entry_id
                .map(|value| value.to_string()),
        )
        .bind(
            fiscal_year
                .carry_forward_entry_id
                .map(|value| value.to_string()),
        )
        .bind(&fiscal_year.last_close_operation_key)
        .bind(fiscal_year.closed_at.map(|value| value.to_rfc3339()))
        .bind(&fiscal_year.closed_by)
        .bind(fiscal_year.locked_at.map(|value| value.to_rfc3339()))
        .bind(&fiscal_year.locked_by)
        .bind(fiscal_year.created_at.to_rfc3339())
        .bind(fiscal_year.updated_at.to_rfc3339())
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year create: {e}")))?;

        Ok(())
    }

    async fn find_by_id(&self, id: &FiscalYearId) -> Result<Option<FiscalYear>, AppError> {
        let row = sqlx::query_as::<_, FiscalYearRow>(
            format!("SELECT {FISCAL_YEAR_COLUMNS} FROM fiscal_years WHERE id = ?").as_str(),
        )
        .bind(id.to_string())
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year find_by_id: {e}")))?;

        row.map(row_to_fiscal_year).transpose()
    }

    async fn list(&self) -> Result<Vec<FiscalYear>, AppError> {
        let rows = sqlx::query_as::<_, FiscalYearRow>(
            format!("SELECT {FISCAL_YEAR_COLUMNS} FROM fiscal_years ORDER BY start_date").as_str(),
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year list: {e}")))?;

        rows.into_iter().map(row_to_fiscal_year).collect()
    }

    async fn find_by_date(&self, date: DateTime<Utc>) -> Result<Vec<FiscalYear>, AppError> {
        let rows = sqlx::query_as::<_, FiscalYearRow>(
            format!(
                "SELECT {FISCAL_YEAR_COLUMNS} FROM fiscal_years WHERE start_date <= ? AND end_date >= ? ORDER BY start_date"
            )
            .as_str(),
        )
        .bind(date.to_rfc3339())
        .bind(date.to_rfc3339())
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year find_by_date: {e}")))?;

        rows.into_iter().map(row_to_fiscal_year).collect()
    }

    async fn update(&self, fiscal_year: &FiscalYear) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE fiscal_years
             SET company_id = ?, label = ?, start_date = ?, end_date = ?, status = ?,
                 previous_fiscal_year_id = ?, closing_period_id = ?, retained_earnings_entry_id = ?,
                 carry_forward_entry_id = ?, last_close_operation_key = ?, closed_at = ?, closed_by = ?,
                 locked_at = ?, locked_by = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(&fiscal_year.company_id)
        .bind(&fiscal_year.label)
        .bind(fiscal_year.start_date.to_rfc3339())
        .bind(fiscal_year.end_date.to_rfc3339())
        .bind(fiscal_year.status.as_str())
        .bind(fiscal_year.previous_fiscal_year_id.map(|value| value.to_string()))
        .bind(fiscal_year.closing_period_id.map(|value| value.to_string()))
        .bind(
            fiscal_year
                .retained_earnings_entry_id
                .map(|value| value.to_string()),
        )
        .bind(
            fiscal_year
                .carry_forward_entry_id
                .map(|value| value.to_string()),
        )
        .bind(&fiscal_year.last_close_operation_key)
        .bind(fiscal_year.closed_at.map(|value| value.to_rfc3339()))
        .bind(&fiscal_year.closed_by)
        .bind(fiscal_year.locked_at.map(|value| value.to_rfc3339()))
        .bind(&fiscal_year.locked_by)
        .bind(fiscal_year.updated_at.to_rfc3339())
        .bind(fiscal_year.id.to_string())
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year update: {e}")))?;

        Ok(())
    }

    async fn find_close_run(
        &self,
        fiscal_year_id: &FiscalYearId,
        operation_key: &str,
    ) -> Result<Option<FiscalYearCloseRun>, AppError> {
        let row = sqlx::query_as::<_, CloseRunRow>(
            format!(
                "SELECT {CLOSE_RUN_COLUMNS} FROM fiscal_year_close_runs WHERE fiscal_year_id = ? AND operation_key = ?"
            )
            .as_str(),
        )
        .bind(fiscal_year_id.to_string())
        .bind(operation_key)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year close_run find: {e}")))?;

        row.map(row_to_close_run).transpose()
    }

    async fn create_close_run(&self, run: &FiscalYearCloseRun) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO fiscal_year_close_runs (
                fiscal_year_id, operation_key, actor_id, status, closing_period_id,
                retained_earnings_entry_id, carry_forward_entry_id, error_message,
                started_at, completed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(run.fiscal_year_id.to_string())
        .bind(&run.operation_key)
        .bind(&run.actor_id)
        .bind(run.status.as_str())
        .bind(run.closing_period_id.map(|value| value.to_string()))
        .bind(
            run.retained_earnings_entry_id
                .map(|value| value.to_string()),
        )
        .bind(run.carry_forward_entry_id.map(|value| value.to_string()))
        .bind(&run.error_message)
        .bind(run.started_at.to_rfc3339())
        .bind(run.completed_at.map(|value| value.to_rfc3339()))
        .bind(run.updated_at.to_rfc3339())
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year close_run create: {e}")))?;

        Ok(())
    }

    async fn update_close_run(&self, run: &FiscalYearCloseRun) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE fiscal_year_close_runs
             SET actor_id = ?, status = ?, closing_period_id = ?, retained_earnings_entry_id = ?,
                 carry_forward_entry_id = ?, error_message = ?, started_at = ?, completed_at = ?, updated_at = ?
             WHERE fiscal_year_id = ? AND operation_key = ?",
        )
        .bind(&run.actor_id)
        .bind(run.status.as_str())
        .bind(run.closing_period_id.map(|value| value.to_string()))
        .bind(
            run.retained_earnings_entry_id
                .map(|value| value.to_string()),
        )
        .bind(run.carry_forward_entry_id.map(|value| value.to_string()))
        .bind(&run.error_message)
        .bind(run.started_at.to_rfc3339())
        .bind(run.completed_at.map(|value| value.to_rfc3339()))
        .bind(run.updated_at.to_rfc3339())
        .bind(run.fiscal_year_id.to_string())
        .bind(&run.operation_key)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("fiscal_year close_run update: {e}")))?;

        Ok(())
    }
}
