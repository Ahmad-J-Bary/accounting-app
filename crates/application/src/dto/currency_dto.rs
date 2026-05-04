use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyDto {
    pub code: String,
    pub name: String,
    pub name_ar: String,
    pub name_en: String,
    pub symbol: String,
    pub decimals: i32,
    pub is_base: bool,
    pub is_active: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRateDto {
    pub id: String,
    pub from_currency: String,
    pub to_currency: String,
    pub rate: String,
    pub rate_type: String, // Purchase | Sale | Middle | Closing
    pub rate_date: String,
    pub source: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCurrencyDto {
    pub code: String,
    pub name: Option<String>,
    pub name_ar: String,
    pub name_en: String,
    pub symbol: String,
    pub decimals: i32,
    pub is_base: bool,
    pub is_active: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCurrencyDto {
    pub code: String,
    pub name: Option<String>,
    pub name_ar: String,
    pub name_en: String,
    pub symbol: String,
    pub decimals: i32,
    pub is_active: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetExchangeRateDto {
    pub from_currency: String,
    pub to_currency: String,
    pub rate: String,
    pub rate_type: String,
    pub rate_date: String,
    pub source: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodayRateStatusDto {
    pub currency_code: String,
    pub currency_name_ar: String,
    pub currency_name_en: String,
    pub currency_symbol: String,
    pub has_rate_today: bool,
    pub rate: Option<String>,
    pub rate_type: Option<String>,
    pub last_rate: Option<String>,
    pub last_rate_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyContextDto {
    pub base_currency_code: String,
    pub active_currencies: Vec<CurrencyDto>,
    pub today_status: Vec<TodayRateStatusDto>,
    pub last_updated_at: Option<String>,
}
