use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use domain::shared::ids::FiscalYearId;

use super::close::require_permission;
use super::create::to_dto;
use super::types::{FiscalYearDto, ReopenFiscalYearCommand};

pub struct ReopenFiscalYearUseCase {
    repo: Arc<dyn FiscalYearRepository>,
}

impl ReopenFiscalYearUseCase {
    pub fn new(repo: Arc<dyn FiscalYearRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, cmd: ReopenFiscalYearCommand) -> Result<FiscalYearDto, AppError> {
        require_permission(&cmd.context, "fiscal_year.reopen")?;

        let fiscal_year_id = cmd
            .fiscal_year_id
            .parse::<FiscalYearId>()
            .map_err(|_| AppError::Invalid("معرف السنة المالية غير صالح".into()))?;

        let Some(mut fiscal_year) = self.repo.find_by_id(&fiscal_year_id).await? else {
            return Err(AppError::NotFound("السنة المالية غير موجودة".into()));
        };

        fiscal_year.reopen()?;
        self.repo.update(&fiscal_year).await?;
        Ok(to_dto(&fiscal_year, None))
    }
}
