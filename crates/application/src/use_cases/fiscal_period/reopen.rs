use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::use_cases::fiscal_period::types::{FiscalPeriodDto, ReopenFiscalPeriodCommand};
use domain::shared::ids::FiscalPeriodId;
use std::sync::Arc;

use super::create::to_dto;

/// Reopens a previously Closed fiscal period (Closed -> Reopened) so explicit
/// corrections can be recorded. A Locked (permanently sealed) or Cancelled
/// period cannot be reopened.
pub struct ReopenFiscalPeriodUseCase {
    period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl ReopenFiscalPeriodUseCase {
    pub fn new(period_repo: Arc<dyn FiscalPeriodRepository>) -> Self {
        Self { period_repo }
    }

    pub async fn execute(&self, cmd: ReopenFiscalPeriodCommand) -> Result<FiscalPeriodDto, AppError> {
        let period_id = cmd
            .period_id
            .parse::<FiscalPeriodId>()
            .map_err(|_| AppError::Invalid("معرف الفترة المالية غير صالح".into()))?;

        let Some(mut period) = self.period_repo.find_by_id(&period_id).await? else {
            return Err(AppError::NotFound("الفترة المالية غير موجودة".into()));
        };

        period.reopen().map_err(AppError::from)?;
        self.period_repo.update(&period).await?;
        Ok(to_dto(&period))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::MockFiscalPeriodRepository;
    use chrono::{Duration, Utc};
    use domain::accounting::fiscal_period::{FiscalPeriod, FiscalPeriodStatus};
    use std::sync::Arc;

    #[tokio::test]
    async fn reopens_a_closed_period() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        let mut period = FiscalPeriod::new(None, start, end).unwrap();
        period.close("admin", FiscalPeriodStatus::Closed).unwrap();
        repo.create(&period).await.unwrap();

        let uc = ReopenFiscalPeriodUseCase::new(repo.clone());
        let dto = uc
            .execute(ReopenFiscalPeriodCommand {
                period_id: period.id.to_string(),
            })
            .await
            .unwrap();
        assert_eq!(dto.status, "Reopened");
        assert!(dto.closed_at.is_none());
    }

    #[tokio::test]
    async fn locked_period_cannot_reopen() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        let mut period = FiscalPeriod::new(None, start, end).unwrap();
        period.lock("admin").unwrap();
        repo.create(&period).await.unwrap();

        let uc = ReopenFiscalPeriodUseCase::new(repo.clone());
        let err = uc
            .execute(ReopenFiscalPeriodCommand {
                period_id: period.id.to_string(),
            })
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::Domain(_)), "got {:?}", err);
    }

    #[tokio::test]
    async fn missing_period_errors() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let uc = ReopenFiscalPeriodUseCase::new(repo.clone());
        let err = uc
            .execute(ReopenFiscalPeriodCommand {
                period_id: FiscalPeriodId::new().to_string(),
            })
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }
}