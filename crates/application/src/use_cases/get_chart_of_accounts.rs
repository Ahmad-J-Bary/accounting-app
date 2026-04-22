use std::sync::Arc;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::dto::account_dto::AccountDto;

pub struct GetChartOfAccountsUseCase {
    repo: Arc<dyn AccountRepository>,
}

impl GetChartOfAccountsUseCase {
    pub fn new(repo: Arc<dyn AccountRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<AccountDto>, AppError> {
        let accounts = self.repo.list_all().await?;
        Ok(accounts.into_iter().map(AccountDto::from).collect())
    }
}
