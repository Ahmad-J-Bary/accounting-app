use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::use_cases::fiscal_period::types::{CloseFiscalPeriodCommand, FiscalPeriodDto};
use domain::accounting::fiscal_period::FiscalPeriodStatus;
use domain::shared::ids::FiscalPeriodId;
use std::sync::Arc;

use super::create::to_dto;

pub struct CloseFiscalPeriodUseCase {
    period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl CloseFiscalPeriodUseCase {
    pub fn new(period_repo: Arc<dyn FiscalPeriodRepository>) -> Self {
        Self { period_repo }
    }

    /// Closes (or finalizes the closing of) a fiscal period. Re-running the
    /// command for an already-closed period is idempotent: the existing state
    /// is returned unchanged instead of failing.
    pub async fn execute(&self, cmd: CloseFiscalPeriodCommand) -> Result<FiscalPeriodDto, AppError> {
        let period_id = cmd
            .period_id
            .parse::<FiscalPeriodId>()
            .map_err(|_| AppError::Invalid("معرف الفترة المالية غير صالح".into()))?;

        let Some(mut period) = self.period_repo.find_by_id(&period_id).await? else {
            return Err(AppError::NotFound("الفترة المالية غير موجودة".into()));
        };

        // Idempotent close: an already Closed / Locked / Cancelled period is
        // returned as-is.
        if matches!(
            period.status,
            FiscalPeriodStatus::Closed | FiscalPeriodStatus::Locked | FiscalPeriodStatus::Cancelled
        ) || (period.status == FiscalPeriodStatus::Closing && !cmd.finalize)
        {
            return Ok(to_dto(&period));
        }

        let target = if cmd.finalize {
            FiscalPeriodStatus::Closed
        } else {
            FiscalPeriodStatus::Closing
        };
        period.close(&cmd.closed_by, target)?;

        self.period_repo.update(&period).await?;
        Ok(to_dto(&period))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    use domain::accounting::fiscal_period::FiscalPeriod;
    use crate::mocks::MockFiscalPeriodRepository;

    async fn seeded(repo: &Arc<MockFiscalPeriodRepository>) -> FiscalPeriodId {
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        let period = FiscalPeriod::new(None, start, end).unwrap();
        repo.create(&period).await.unwrap();
        period.id
    }

    #[tokio::test]
    async fn closes_an_open_period() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let id = seeded(&repo).await;
        let uc = CloseFiscalPeriodUseCase::new(repo.clone());
        let dto = uc
            .execute(CloseFiscalPeriodCommand {
                period_id: id.to_string(),
                closed_by: "admin".into(),
                finalize: true,
            })
            .await
            .unwrap();
        assert_eq!(dto.status, "Closed");
        assert_eq!(dto.closed_by.as_deref(), Some("admin"));
    }

    #[tokio::test]
    async fn closing_then_finalize() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let id = seeded(&repo).await;
        let uc = CloseFiscalPeriodUseCase::new(repo.clone());
        let cmd = |finalize: bool| CloseFiscalPeriodCommand {
            period_id: id.to_string(),
            closed_by: "admin".into(),
            finalize,
        };
        let dto = uc.execute(cmd(false)).await.unwrap();
        assert_eq!(dto.status, "Closing");
        let dto = uc.execute(cmd(true)).await.unwrap();
        assert_eq!(dto.status, "Closed");
    }

    #[tokio::test]
    async fn close_is_idempotent() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let id = seeded(&repo).await;
        let uc = CloseFiscalPeriodUseCase::new(repo.clone());
        let cmd = CloseFiscalPeriodCommand {
            period_id: id.to_string(),
            closed_by: "admin".into(),
            finalize: true,
        };
        uc.execute(cmd.clone()).await.unwrap();
        // Re-executing (e.g. retried request) returns the same closed state.
        let dto = uc.execute(cmd.clone()).await.unwrap();
        assert_eq!(dto.status, "Closed");
        assert_eq!(dto.closed_by.as_deref(), Some("admin"));
    }

    #[tokio::test]
    async fn not_found_period_errors() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let uc = CloseFiscalPeriodUseCase::new(repo.clone());
        let err = uc
            .execute(CloseFiscalPeriodCommand {
                period_id: FiscalPeriodId::new().to_string(),
                closed_by: "admin".into(),
                finalize: true,
            })
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }
}