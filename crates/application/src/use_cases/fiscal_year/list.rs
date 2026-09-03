use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::fiscal_year_repository::FiscalYearRepository;

use super::create::to_dto;
use super::types::FiscalYearDto;

pub struct ListFiscalYearsUseCase {
    repo: Arc<dyn FiscalYearRepository>,
}

impl ListFiscalYearsUseCase {
    pub fn new(repo: Arc<dyn FiscalYearRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<FiscalYearDto>, AppError> {
        let fiscal_years = self.repo.list().await?;
        Ok(fiscal_years
            .into_iter()
            .map(|year| to_dto(&year, None))
            .collect())
    }
}
