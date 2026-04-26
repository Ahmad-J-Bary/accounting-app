use thiserror::Error;
use serde::Serialize;

#[derive(Debug, Error, Serialize)]
pub enum DomainError {
    #[error("خطأ في البيانات: {0}")]
    Invalid(String),
    
    #[error("البيانات المطلوبة مفقودة: {0}")]
    Missing(String),
    
    #[error("القيمة غير صالحة: {0}")]
    OutOfRange(String),
    
    #[error("العملية غير مسموحة: {0}")]
    Forbidden(String),
    
    #[error("تعارض في البيانات: {0}")]
    Conflict(String),
}
