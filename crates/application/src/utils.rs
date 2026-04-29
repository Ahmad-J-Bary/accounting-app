use rust_decimal::Decimal;
use std::str::FromStr;
use domain::shared::currency::Currency;
use crate::errors::AppError;

/// يحول نصاً إلى Decimal مع معالجة الأخطاء برسالة مخصصة
pub fn parse_decimal(val: Option<&str>, field_name: &str) -> Result<Decimal, AppError> {
    match val {
        Some(s) if !s.trim().is_empty() => {
            Decimal::from_str(s)
                .map_err(|_| AppError::Invalid(format!("قيمة حقل '{}' غير صالحة", field_name)))
        }
        _ => Ok(Decimal::ZERO)
    }
}

/// يحول نص العملة إلى النوع المحدد في الدومين
pub fn parse_currency(val: Option<&str>) -> Currency {
    match val {
        Some("USD") => Currency::USD,
        _ => Currency::SYP,
    }
}

/// يولد كوداً افتراضياً إذا كان الكود المقدم فارغاً
pub fn ensure_code(provided: Option<String>, default: String) -> String {
    match provided {
        Some(c) if !c.trim().is_empty() => c,
        _ => default
    }
}
