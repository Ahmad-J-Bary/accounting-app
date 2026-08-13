use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::use_cases::fiscal_period::types::{FiscalPeriodDto, LockFiscalPeriodCommand};
use domain::accounting::fiscal_period::FiscalPeriodStatus;
use domain::shared::ids::FiscalPeriodId;
use std::sync::Arc;

use super::create::to_dto;

/// Permanently seals a fiscal period (Open/Closing/Closed/Reopened -> Locked).
/// A Locked period blocks posting and cannot be reopened through the normal
/// flow. Re-running for an already-locked period is idempotent.
pub struct LockFiscalPeriodUseCase {
    period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl LockFiscalPeriodUseCase {
    pub fn new(period_repo: Arc<dyn FiscalPeriodRepository>) -> Self {
        Self { period_repo }
    }

    pub async fn execute(&self, cmd: LockFiscalPeriodCommand) -> Result<FiscalPeriodDto, AppError> {
        let period_id = cmd
            .period_id
            .parse::<FiscalPeriodId>()
            .map_err(|_| AppError::Invalid("معرف الفترة المالية غير صالح".into()))?;

        let Some(mut period) = self.period_repo.find_by_id(&period_id).await? else {
            return Err(AppError::NotFound("الفترة المالية غير موجودة".into()));
        };

        if period.status == FiscalPeriodStatus::Locked {
            return Ok(to_dto(&period));
        }

        period.lock(&cmd.locked_by).map_err(AppError::from)?;
        self.period_repo.update(&period).await?;
        Ok(to_dto(&period))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::MockFiscalPeriodRepository;
    use chrono::{Duration, Utc};
    use domain::accounting::fiscal_period::FiscalPeriod;
    use std::sync::Arc;

    #[tokio::test]
    async fn locks_an_open_period() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        let period = FiscalPeriod::new(None, start, end).unwrap();
        repo.create(&period).await.unwrap();

        let uc = LockFiscalPeriodUseCase::new(repo.clone());
        let dto = uc
            .execute(LockFiscalPeriodCommand {
                period_id: period.id.to_string(),
                locked_by: "admin".into(),
            })
            .await
            .unwrap();
        assert_eq!(dto.status, "Locked");
        assert_eq!(dto.locked_by.as_deref(), Some("admin"));
        assert!(dto.locked_at.is_some());
    }

    #[tokio::test]
    async fn lock_is_idempotent() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        let period = FiscalPeriod::new(None, start, end).unwrap();
        repo.create(&period).await.unwrap();

        let uc = LockFiscalPeriodUseCase::new(repo.clone());
        let cmd = || LockFiscalPeriodCommand {
            period_id: period.id.to_string(),
            locked_by: "admin".into(),
        };
        let dto = uc.execute(cmd()).await.unwrap();
        assert_eq!(dto.status, "Locked");
        let dto = uc.execute(cmd()).await.unwrap();
        assert_eq!(dto.status, "Locked");
        assert_eq!(repo.list().await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn missing_period_errors() {
        let repo = Arc::new(MockFiscalPeriodRepository::new());
        let uc = LockFiscalPeriodUseCase::new(repo.clone());
        let err = uc
            .execute(LockFiscalPeriodCommand {
                period_id: FiscalPeriodId::new().to_string(),
                locked_by: "admin".into(),
            })
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }
}