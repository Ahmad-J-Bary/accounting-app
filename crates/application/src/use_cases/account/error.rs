use thiserror::Error;
use domain::shared::errors::DomainError;

#[derive(Error, Debug)]
pub enum AccountUseCaseError {
    #[error("Account repository error: {0}")]
    RepositoryError(String),

    #[error("Journal repository error: {0}")]
    JournalRepositoryError(String),

    #[error("Account not found")]
    AccountNotFound,

    #[error("Parent account not found")]
    ParentNotFound,

    #[error("Code {0} already exists")]
    CodeExists(String),

    #[error("Invalid decimal value: {0}")]
    InvalidDecimal(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Forbidden operation: {0}")]
    Forbidden(String),

    #[error("Domain error: {0}")]
    Domain(#[from] DomainError),
}
