use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
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

    #[error("غير مسموح: {0}")]
    Forbidden(String),

    #[error("يتطلب صلاحيات إضافية: {0}")]
    Unauthorized(String),

    #[error("القدرة غير مفعلة: {0}")]
    CapabilityDenied(String),

    #[error("العملية محظورة بسبب حالة الدورة المحاسبية: {0}")]
    LifecycleBlocked(String),

    #[error("لا توجد سنة مالية مطابقة لتاريخ العملية: {0}")]
    MissingFiscalYear(String),

    #[error("لا توجد فترة مالية مطابقة لتاريخ العملية: {0}")]
    MissingFiscalPeriod(String),

    #[error("السنة المالية لا تسمح بالترحيل: {0}")]
    FiscalYearClosed(String),

    #[error("الفترة المالية لا تسمح بالترحيل: {0}")]
    FiscalPeriodClosed(String),

    #[error("الإعداد المحاسبي الدوري متداخل أو ملتبس: {0}")]
    AmbiguousFiscalLifecycle(String),

    #[error("إعداد الدورة المحاسبية غير صالح: {0}")]
    InvalidFiscalLifecycle(String),

    #[error("العملية غير مدعومة: {0}")]
    Unsupported(String),

    #[error("خطأ غير معروف: {0}")]
    Unknown(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Domain(_) => "domain_error",
            Self::Infrastructure(_) => "infrastructure_error",
            Self::NotFound(_) => "not_found",
            Self::Conflict(_) => "conflict",
            Self::Invalid(_) => "invalid",
            Self::Forbidden(_) => "forbidden",
            Self::Unauthorized(_) => "unauthorized",
            Self::CapabilityDenied(_) => "capability_denied",
            Self::LifecycleBlocked(_) => "lifecycle_blocked",
            Self::MissingFiscalYear(_) => "missing_fiscal_year",
            Self::MissingFiscalPeriod(_) => "missing_fiscal_period",
            Self::FiscalYearClosed(_) => "fiscal_year_closed",
            Self::FiscalPeriodClosed(_) => "fiscal_period_closed",
            Self::AmbiguousFiscalLifecycle(_) => "ambiguous_fiscal_lifecycle",
            Self::InvalidFiscalLifecycle(_) => "invalid_fiscal_lifecycle",
            Self::Unsupported(_) => "unsupported",
            Self::Unknown(_) => "unknown",
        }
    }
}
