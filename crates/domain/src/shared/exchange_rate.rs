use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RateType {
    Purchase,
    Sale,
    Middle,
    Closing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExchangeRate {
    pub id: String,
    pub from_currency: String, // Code
    pub to_currency: String,   // Code
    pub rate: Decimal,
    pub rate_type: RateType,
    pub rate_date: DateTime<Utc>,
    pub source: Option<String>,
    pub user_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl ExchangeRate {
    pub fn new(
        from: &str,
        to: &str,
        rate: Decimal,
        rate_type: RateType,
        date: DateTime<Utc>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            from_currency: from.to_string(),
            to_currency: to.to_string(),
            rate,
            rate_type,
            rate_date: date,
            source: None,
            user_id: None,
            created_at: Utc::now(),
        }
    }
}
