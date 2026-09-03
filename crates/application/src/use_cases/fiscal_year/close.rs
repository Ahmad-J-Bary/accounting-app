use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use domain::accounting::fiscal_period::FiscalPeriodStatus;
use domain::accounting::fiscal_year::{FiscalYearCloseRun, FiscalYearCloseRunStatus, FiscalYearStatus};
use domain::shared::ids::{FiscalPeriodId, FiscalYearId, JournalEntryId};

use super::create::to_dto;
use super::types::{CloseFiscalYearCommand, FiscalYearCloseRunDto, FiscalYearDto};

pub struct CloseFiscalYearUseCase {
    year_repo: Arc<dyn FiscalYearRepository>,
    period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl CloseFiscalYearUseCase {
    pub fn new(
        year_repo: Arc<dyn FiscalYearRepository>,
        period_repo: Arc<dyn FiscalPeriodRepository>,
    ) -> Self {
        Self {
            year_repo,
            period_repo,
        }
    }

    pub async fn execute(&self, cmd: CloseFiscalYearCommand) -> Result<FiscalYearDto, AppError> {
        require_permission(&cmd.context, "fiscal_year.close")?;

        let fiscal_year_id = cmd
            .fiscal_year_id
            .parse::<FiscalYearId>()
            .map_err(|_| AppError::Invalid("معرف السنة المالية غير صالح".into()))?;
        let closing_period_id = cmd
            .closing_period_id
            .parse::<FiscalPeriodId>()
            .map_err(|_| AppError::Invalid("معرف فترة الإقفال غير صالح".into()))?;
        let retained_earnings_entry_id = parse_optional_journal_id(
            cmd.retained_earnings_entry_id.as_deref(),
            "معرف قيد الأرباح المبقاة غير صالح",
        )?;
        let carry_forward_entry_id = parse_optional_journal_id(
            cmd.carry_forward_entry_id.as_deref(),
            "معرف قيد الترحيل الافتتاحي غير صالح",
        )?;

        let Some(mut fiscal_year) = self.year_repo.find_by_id(&fiscal_year_id).await? else {
            return Err(AppError::NotFound("السنة المالية غير موجودة".into()));
        };

        if let Some(existing_run) = self
            .year_repo
            .find_close_run(&fiscal_year_id, &cmd.operation_key)
            .await?
        {
            if existing_run.status == FiscalYearCloseRunStatus::Completed {
                return Ok(to_dto(&fiscal_year, Some(close_run_to_dto(&existing_run))));
            }
        }

        validate_year_close(&fiscal_year, &closing_period_id, self.period_repo.clone()).await?;

        let mut close_run = match self
            .year_repo
            .find_close_run(&fiscal_year_id, &cmd.operation_key)
            .await?
        {
            Some(run) => run,
            None => {
                let run = FiscalYearCloseRun::start(
                    fiscal_year_id,
                    cmd.operation_key.clone(),
                    actor_id(&cmd.context),
                )?;
                self.year_repo.create_close_run(&run).await?;
                run
            }
        };

        if fiscal_year.status == FiscalYearStatus::Closed
            && fiscal_year.last_close_operation_key.as_deref() == Some(cmd.operation_key.as_str())
        {
            return Ok(to_dto(&fiscal_year, Some(close_run_to_dto(&close_run))));
        }

        fiscal_year.start_closing(&actor_id(&cmd.context), &cmd.operation_key)?;

        if cmd.finalize {
            fiscal_year.finalize_close(
                &actor_id(&cmd.context),
                &cmd.operation_key,
                closing_period_id,
                retained_earnings_entry_id,
                carry_forward_entry_id,
            )?;
            close_run.complete(
                closing_period_id,
                retained_earnings_entry_id,
                carry_forward_entry_id,
            );
        }

        self.year_repo.update(&fiscal_year).await?;
        self.year_repo.update_close_run(&close_run).await?;

        Ok(to_dto(&fiscal_year, Some(close_run_to_dto(&close_run))))
    }
}

fn actor_id(context: &domain::shared::ExecutionContext) -> String {
    context
        .actor_id
        .clone()
        .unwrap_or_else(|| "system".into())
}

pub(crate) fn require_permission(
    context: &domain::shared::ExecutionContext,
    permission_key: &str,
) -> Result<(), AppError> {
    if context.has_permission("Admin") || context.has_permission(permission_key) {
        return Ok(());
    }

    Err(AppError::Forbidden(format!(
        "لا تملك صلاحية تنفيذ العملية المطلوبة: {permission_key}"
    )))
}

fn parse_optional_journal_id(
    value: Option<&str>,
    message: &str,
) -> Result<Option<JournalEntryId>, AppError> {
    value
        .map(|raw| {
            raw.parse::<JournalEntryId>()
                .map_err(|_| AppError::Invalid(message.into()))
        })
        .transpose()
}

async fn validate_year_close(
    fiscal_year: &domain::accounting::fiscal_year::FiscalYear,
    closing_period_id: &FiscalPeriodId,
    period_repo: Arc<dyn FiscalPeriodRepository>,
) -> Result<(), AppError> {
    let periods = period_repo.list().await?;
    let in_year: Vec<_> = periods
        .into_iter()
        .filter(|period| {
            period.company_id == fiscal_year.company_id
                && period.start_date >= fiscal_year.start_date
                && period.end_date <= fiscal_year.end_date
        })
        .collect();

    if in_year.is_empty() {
        return Err(AppError::LifecycleBlocked(
            "لا يمكن إقفال سنة مالية بلا فترات مالية مرتبطة ضمن نطاقها".into(),
        ));
    }

    if !in_year.iter().any(|period| period.id == *closing_period_id) {
        return Err(AppError::Invalid(
            "فترة الإقفال المحددة ليست ضمن السنة المالية".into(),
        ));
    }

    let invalid: Vec<String> = in_year
        .iter()
        .filter(|period| {
            !matches!(
                period.status,
                FiscalPeriodStatus::Closed | FiscalPeriodStatus::Locked
            )
        })
        .map(|period| format!("{}..{} ({})", period.start_date.date_naive(), period.end_date.date_naive(), period.status.as_str()))
        .collect();

    if !invalid.is_empty() {
        return Err(AppError::LifecycleBlocked(format!(
            "لا يمكن إقفال السنة المالية قبل إغلاق/قفل جميع الفترات: {}",
            invalid.join("، ")
        )));
    }

    Ok(())
}

pub(crate) fn close_run_to_dto(run: &FiscalYearCloseRun) -> FiscalYearCloseRunDto {
    FiscalYearCloseRunDto {
        operation_key: run.operation_key.clone(),
        actor_id: run.actor_id.clone(),
        status: run.status.as_str().into(),
        closing_period_id: run.closing_period_id.map(|value| value.to_string()),
        retained_earnings_entry_id: run
            .retained_earnings_entry_id
            .map(|value| value.to_string()),
        carry_forward_entry_id: run.carry_forward_entry_id.map(|value| value.to_string()),
        error_message: run.error_message.clone(),
        started_at: run.started_at.to_rfc3339(),
        completed_at: run.completed_at.map(|value| value.to_rfc3339()),
        updated_at: run.updated_at.to_rfc3339(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockFiscalPeriodRepository, MockFiscalYearRepository};
    use chrono::{Duration, Utc};
    use domain::accounting::fiscal_period::FiscalPeriod;
    use domain::accounting::fiscal_year::FiscalYear;
    use domain::shared::ExecutionContext;

    async fn seed_year_and_periods(
        year_repo: &Arc<MockFiscalYearRepository>,
        period_repo: &Arc<MockFiscalPeriodRepository>,
    ) -> (FiscalYearId, FiscalPeriodId) {
        let start = Utc::now() - Duration::days(365);
        let end = Utc::now() + Duration::days(1);
        let year = FiscalYear::new(None, "FY".into(), start, end, None).unwrap();
        year_repo.create(&year).await.unwrap();

        let mut period = FiscalPeriod::new(None, start, end).unwrap();
        period.close("admin", FiscalPeriodStatus::Closed).unwrap();
        let period_id = period.id;
        period_repo.create(&period).await.unwrap();

        (year.id, period_id)
    }

    #[tokio::test]
    async fn closes_year_idempotently() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let (year_id, period_id) = seed_year_and_periods(&year_repo, &period_repo).await;
        let use_case = CloseFiscalYearUseCase::new(year_repo.clone(), period_repo.clone());

        let command = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-1".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: ExecutionContext {
                actor_id: Some("admin".into()),
                permission_keys: vec!["fiscal_year.close".into()],
                ..ExecutionContext::default()
            },
        };

        let first = use_case.execute(command.clone()).await.unwrap();
        let second = use_case.execute(command).await.unwrap();
        assert_eq!(first.status, "Closed");
        assert_eq!(second.status, "Closed");
        assert_eq!(
            second.latest_close_run.as_ref().map(|run| run.status.as_str()),
            Some("Completed")
        );
    }

    #[tokio::test]
    async fn rejects_close_without_permission() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let (year_id, period_id) = seed_year_and_periods(&year_repo, &period_repo).await;
        let use_case = CloseFiscalYearUseCase::new(year_repo.clone(), period_repo.clone());

        let error = use_case
            .execute(CloseFiscalYearCommand {
                fiscal_year_id: year_id.to_string(),
                closing_period_id: period_id.to_string(),
                operation_key: "fy-close-1".into(),
                finalize: true,
                retained_earnings_entry_id: None,
                carry_forward_entry_id: None,
                context: ExecutionContext::default(),
            })
            .await
            .unwrap_err();

        assert!(matches!(error, AppError::Forbidden(_)));
    }

    #[tokio::test]
    async fn rejects_when_any_period_is_not_closed() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(365);
        let end = Utc::now() + Duration::days(1);
        let year = FiscalYear::new(None, "FY".into(), start, end, None).unwrap();
        year_repo.create(&year).await.unwrap();

        let period = FiscalPeriod::new(None, start, end).unwrap();
        let period_id = period.id;
        period_repo.create(&period).await.unwrap();

        let use_case = CloseFiscalYearUseCase::new(year_repo.clone(), period_repo.clone());
        let error = use_case
            .execute(CloseFiscalYearCommand {
                fiscal_year_id: year.id.to_string(),
                closing_period_id: period_id.to_string(),
                operation_key: "fy-close-1".into(),
                finalize: true,
                retained_earnings_entry_id: None,
                carry_forward_entry_id: None,
                context: ExecutionContext {
                    actor_id: Some("admin".into()),
                    permission_keys: vec!["fiscal_year.close".into()],
                    ..ExecutionContext::default()
                },
            })
            .await
            .unwrap_err();

        assert!(matches!(error, AppError::LifecycleBlocked(_)));
    }
}
