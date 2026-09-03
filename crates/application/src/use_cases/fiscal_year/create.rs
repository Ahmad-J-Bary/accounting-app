use std::sync::Arc;

use chrono::{DateTime, Utc};
use domain::accounting::fiscal_year::FiscalYear;
use domain::shared::ids::FiscalYearId;

use crate::errors::AppError;
use crate::ports::fiscal_year_repository::FiscalYearRepository;

use super::types::{CreateFiscalYearCommand, FiscalYearDto};

pub struct CreateFiscalYearUseCase {
    repo: Arc<dyn FiscalYearRepository>,
}

impl CreateFiscalYearUseCase {
    pub fn new(repo: Arc<dyn FiscalYearRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, cmd: CreateFiscalYearCommand) -> Result<FiscalYearDto, AppError> {
        let start_date = parse_utc(&cmd.start_date, "بداية السنة المالية")?;
        let end_date = parse_utc(&cmd.end_date, "نهاية السنة المالية")?;
        let previous_fiscal_year_id = cmd
            .previous_fiscal_year_id
            .as_deref()
            .map(|value| {
                value
                    .parse::<FiscalYearId>()
                    .map_err(|_| AppError::Invalid("معرف السنة المالية السابقة غير صالح".into()))
            })
            .transpose()?;

        let fiscal_year = FiscalYear::new(
            cmd.company_id,
            cmd.label,
            start_date,
            end_date,
            previous_fiscal_year_id,
        )?;

        self.repo.create(&fiscal_year).await?;
        Ok(to_dto(&fiscal_year, None))
    }
}

pub(crate) fn parse_utc(value: &str, label: &str) -> Result<DateTime<Utc>, AppError> {
    DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&Utc))
        .map_err(|_| AppError::Invalid(format!("{label} غير صالحة")))
}

pub(crate) fn to_dto(
    fiscal_year: &FiscalYear,
    latest_close_run: Option<super::types::FiscalYearCloseRunDto>,
) -> FiscalYearDto {
    FiscalYearDto {
        id: fiscal_year.id.to_string(),
        company_id: fiscal_year.company_id.clone(),
        label: fiscal_year.label.clone(),
        start_date: fiscal_year.start_date.to_rfc3339(),
        end_date: fiscal_year.end_date.to_rfc3339(),
        status: fiscal_year.status.as_str().into(),
        previous_fiscal_year_id: fiscal_year.previous_fiscal_year_id.map(|value| value.to_string()),
        closing_period_id: fiscal_year.closing_period_id.map(|value| value.to_string()),
        retained_earnings_entry_id: fiscal_year
            .retained_earnings_entry_id
            .map(|value| value.to_string()),
        carry_forward_entry_id: fiscal_year
            .carry_forward_entry_id
            .map(|value| value.to_string()),
        last_close_operation_key: fiscal_year.last_close_operation_key.clone(),
        closed_at: fiscal_year.closed_at.map(|value| value.to_rfc3339()),
        closed_by: fiscal_year.closed_by.clone(),
        locked_at: fiscal_year.locked_at.map(|value| value.to_rfc3339()),
        locked_by: fiscal_year.locked_by.clone(),
        created_at: fiscal_year.created_at.to_rfc3339(),
        updated_at: fiscal_year.updated_at.to_rfc3339(),
        latest_close_run,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::MockFiscalYearRepository;

    #[tokio::test]
    async fn creates_fiscal_year() {
        let repo = Arc::new(MockFiscalYearRepository::new());
        let use_case = CreateFiscalYearUseCase::new(repo);

        let dto = use_case
            .execute(CreateFiscalYearCommand {
                company_id: None,
                label: "FY2026".into(),
                start_date: "2026-01-01T00:00:00Z".into(),
                end_date: "2026-12-31T23:59:59Z".into(),
                previous_fiscal_year_id: None,
            })
            .await
            .unwrap();

        assert_eq!(dto.label, "FY2026");
        assert_eq!(dto.status, "Open");
    }
}
