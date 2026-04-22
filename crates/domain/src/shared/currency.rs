use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Currency {
    SYP, // الليرة السورية
    USD, // الدولار الأمريكي
}

impl Currency {
    pub fn code(&self) -> &'static str {
        match self {
            Currency::SYP => "SYP",
            Currency::USD => "USD",
        }
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            Currency::SYP => "ل.س",
            Currency::USD => "$",
        }
    }
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.code())
    }
}
