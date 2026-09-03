use crate::errors::AppError;
use async_trait::async_trait;
use domain::accounting::fiscal_year::{FiscalYear, FiscalYearCloseRun};
use domain::shared::ids::FiscalYearId;

#[async_trait]
pub trait FiscalYearRepository: Send + Sync {
    async fn create(&self, fiscal_year: &FiscalYear) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &FiscalYearId) -> Result<Option<FiscalYear>, AppError>;
    async fn list(&self) -> Result<Vec<FiscalYear>, AppError>;
    async fn update(&self, fiscal_year: &FiscalYear) -> Result<(), AppError>;

    async fn find_close_run(
        &self,
        fiscal_year_id: &FiscalYearId,
        operation_key: &str,
    ) -> Result<Option<FiscalYearCloseRun>, AppError>;
    async fn create_close_run(&self, run: &FiscalYearCloseRun) -> Result<(), AppError>;
    async fn update_close_run(&self, run: &FiscalYearCloseRun) -> Result<(), AppError>;
}
