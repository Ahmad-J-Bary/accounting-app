use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("خطأ في Domain: {0}")]
    Domain(#[from] domain::shared::errors::DomainError),
    
    #[error("خطأ في البنية التحتية: {0}")]
    Infrastructure(String),
    
    #[error("الكيان غير موجود: {0}")]
    NotFound(String),
    
    #[error("تعارض في البيانات: {0}")]
    Conflict(String),
    
    #[error("بيانات غير صالحة: {0}")]
    Invalid(String),
    
    #[error("خطأ غير معروف: {0}")]
    Unknown(String),
}
