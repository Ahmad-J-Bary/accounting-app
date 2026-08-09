use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::use_cases::fiscal_period::types::FiscalPeriodDto;
use std::sync::Arc;

use super::create::to_dto;

pub struct ListFiscalPeriodsUseCase {
    period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl ListFiscalPeriodsUseCase {
    pub fn new(period_repo: Arc<dyn FiscalPeriodRepository>) -> Self {
        Self { period_repo }
    }

    pub async fn execute(&self) -> Result<Vec<FiscalPeriodDto>, AppError> {
        let periods = self.period_repo.list().await?;
        Ok(periods.iter().map(to_dto).collect())
    }
}