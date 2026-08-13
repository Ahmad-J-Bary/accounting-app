use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::use_cases::fiscal_period::types::{CreateFiscalPeriodCommand, FiscalPeriodDto};
use chrono::{DateTime, Utc};
use domain::accounting::fiscal_period::FiscalPeriod;
use std::sync::Arc;

pub struct CreateFiscalPeriodUseCase {
    period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl CreateFiscalPeriodUseCase {
    pub fn new(period_repo: Arc<dyn FiscalPeriodRepository>) -> Self {
        Self { period_repo }
    }

    pub async fn execute(&self, cmd: CreateFiscalPeriodCommand) -> Result<FiscalPeriodDto, AppError> {
        let start = parse_date(&cmd.start_date)?;
        let end = parse_date(&cmd.end_date)?;

        let period = FiscalPeriod::new(cmd.company_id.clone(), start, end)?;

        // Reject overlapping periods within the same company so reporting
        // windows never double-count a date.
        let overlaps = self.period_repo.find_by_date(start).await?;
        for other in &overlaps {
            if other.company_id != cmd.company_id {
                continue;
            }
            if other.id != period.id {
                return Err(AppError::Conflict(format!(
                    "الفترة المالية تتداخل مع فترة موجودة من {} إلى {}",
                    other.start_date.to_rfc3339(),
                    other.end_date.to_rfc3339(),
                )));
            }
        }

        self.period_repo.create(&period).await?;
        Ok(to_dto(&period))
    }
}

fn parse_date(s: &str) -> Result<DateTime<Utc>, AppError> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|_| AppError::Invalid("تاريخ غير صالح (RFC3339)".into()))
}

pub(crate) fn to_dto(p: &FiscalPeriod) -> FiscalPeriodDto {
    FiscalPeriodDto {
        id: p.id.to_string(),
        company_id: p.company_id.clone(),
        start_date: p.start_date.to_rfc3339(),
        end_date: p.end_date.to_rfc3339(),
        status: p.status.as_str().to_string(),
        closed_at: p.closed_at.map(|d| d.to_rfc3339()),
        closed_by: p.closed_by.clone(),
        locked_at: p.locked_at.map(|d| d.to_rfc3339()),
        locked_by: p.locked_by.clone(),
        created_at: p.created_at.to_rfc3339(),
        updated_at: p.updated_at.to_rfc3339(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use crate::mocks::MockFiscalPeriodRepository;
    use chrono::Duration;

    fn cmd(start: &str, end: &str) -> CreateFiscalPeriodCommand {
        CreateFiscalPeriodCommand {
            company_id: None,
            start_date: start.to_string(),
            end_date: end.to_string(),
        }
    }

    #[tokio::test]
    async fn creates_an_open_period() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let uc = CreateFiscalPeriodUseCase::new(repo.clone());
        let dto = uc
            .execute(cmd("2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z"))
            .await
            .unwrap();
        assert_eq!(dto.status, "Open");
        assert!(dto.closed_at.is_none());
        assert_eq!(repo.list().await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn rejects_inverted_window() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let uc = CreateFiscalPeriodUseCase::new(repo.clone());
        assert!(uc
            .execute(cmd("2026-12-31T00:00:00Z", "2026-01-01T00:00:00Z"))
            .await
            .is_err());
    }

    #[tokio::test]
    async fn rejects_overlapping_period() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let uc = CreateFiscalPeriodUseCase::new(repo.clone());
        uc.execute(cmd("2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z"))
            .await
            .unwrap();
        // Overlaps entirely under the first period.
        let err = uc
            .execute(cmd("2026-03-01T00:00:00Z", "2026-05-31T00:00:00Z"))
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::Conflict(_)));
        assert_eq!(repo.list().await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn different_company_periods_may_overlap() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let uc = CreateFiscalPeriodUseCase::new(repo.clone());
        let mut first = cmd("2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z");
        first.company_id = Some("c1".into());
        uc.execute(first).await.unwrap();
        let mut second = cmd("2026-03-01T00:00:00Z", "2026-05-31T00:00:00Z");
        second.company_id = Some("c2".into());
        uc.execute(second).await.unwrap();
        assert_eq!(repo.list().await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn to_dto_round_trips_dates() {
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        let p = FiscalPeriod::new(None, start, end).unwrap();
        let dto = to_dto(&p);
        assert_eq!(dto.start_date, start.to_rfc3339());
        assert_eq!(dto.end_date, end.to_rfc3339());
        assert_eq!(dto.id, p.id.to_string());
    }
}