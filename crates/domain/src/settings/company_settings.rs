use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanySettings {
    pub id: String,
    pub company_name: String,
    pub company_name_en: Option<String>,
    pub tax_number: Option<String>,
    pub commercial_register: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub currency: String,
    pub currency_symbol: String,
    pub tax_rate: Decimal,
    pub invoice_prefix: String,
    pub purchase_prefix: String,
    pub journal_prefix: String,
    pub fiscal_year_start_month: u32,
    pub logo_path: Option<String>,
    pub purchase_warehouse_id: Option<String>,
    pub sales_warehouse_id: Option<String>,
    pub numeral_system: String,
    pub accounting_start_mode: String,
    pub updated_at: DateTime<Utc>,
}

impl Default for CompanySettings {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            company_name: "شركتي".into(),
            company_name_en: None,
            tax_number: None,
            commercial_register: None,
            address: None,
            phone: None,
            email: None,
            currency: "SAR".into(),
            currency_symbol: "ر.س".into(),
            tax_rate: Decimal::ZERO,
            invoice_prefix: "INV".into(),
            purchase_prefix: "PUR".into(),
            journal_prefix: "JE".into(),
            fiscal_year_start_month: 1,
            logo_path: None,
            purchase_warehouse_id: None,
            sales_warehouse_id: None,
            numeral_system: "western".into(),
            accounting_start_mode: "NewCompany".into(),
            updated_at: Utc::now(),
        }
    }
}

impl CompanySettings {
    pub fn new(company_name: String, currency: String) -> Self {
        Self {
            company_name,
            currency,
            ..Self::default()
        }
    }
}
