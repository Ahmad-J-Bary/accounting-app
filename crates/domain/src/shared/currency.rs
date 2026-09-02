use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Currency {
    pub code: String,
    pub name_ar: String,
    pub name_en: String,
    pub symbol: String,
    pub decimals: i32,
    pub is_base: bool,
    pub is_active: bool,
    pub notes: Option<String>,
}

impl Currency {
    pub fn new(
        code: &str,
        name_ar: &str,
        name_en: &str,
        symbol: &str,
        decimals: i32,
        is_base: bool,
    ) -> Self {
        Self {
            code: code.to_string(),
            name_ar: name_ar.to_string(),
            name_en: name_en.to_string(),
            symbol: symbol.to_string(),
            decimals,
            is_base,
            is_active: true,
            notes: None,
        }
    }
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.code)
    }
}
