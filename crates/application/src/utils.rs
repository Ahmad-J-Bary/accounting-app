use crate::errors::AppError;
use domain::shared::currency::Currency;
use rust_decimal::Decimal;
use std::str::FromStr;

/// ÙŠØ­ÙˆÙ„ Ù†ØµØ§Ù‹ Ø¥Ù„Ù‰ Decimal Ù…Ø¹ Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø£Ø®Ø·Ø§Ø¡ Ø¨Ø±Ø³Ø§Ù„Ø© Ù…Ø®ØµØµØ©
pub fn parse_decimal(val: Option<&str>, field_name: &str) -> Result<Decimal, AppError> {
    match val {
        Some(s) if !s.trim().is_empty() => Decimal::from_str(s).map_err(|_| {
            AppError::Invalid(format!("Ù‚ÙŠÙ…Ø© Ø­Ù‚Ù„ '{}' ØºÙŠØ± ØµØ§Ù„Ø­Ø©", field_name))
        }),
        _ => Ok(Decimal::ZERO),
    }
}

/// ÙŠØ­ÙˆÙ„ Ù†Øµ Ø§Ù„Ø¹Ù…Ù„Ø© Ø¥Ù„Ù‰ Ø§Ù„Ù†ÙˆØ¹ Ø§Ù„Ù…Ø­Ø¯Ø¯ ÙÙŠ Ø§Ù„Ø¯ÙˆÙ…ÙŠÙ†
pub fn parse_currency(val: Option<&str>) -> Currency {
    let code = val.unwrap_or("");
    Currency::new(code, code, code, "", 2, false)
}

/// ÙŠÙˆÙ„Ø¯ ÙƒÙˆØ¯Ø§Ù‹ Ø§ÙØªØ±Ø§Ø¶ÙŠØ§Ù‹ Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„ÙƒÙˆØ¯ Ø§Ù„Ù…Ù‚Ø¯Ù… ÙØ§Ø±ØºØ§Ù‹
pub fn ensure_code(provided: Option<String>, default: String) -> String {
    match provided {
        Some(c) if !c.trim().is_empty() => c,
        _ => default,
    }
}
