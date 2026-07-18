use domain::settings::CompanySettings;
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::{DateTime, Utc};
use super::models::SettingsRow;

pub fn row_to_settings(row: SettingsRow) -> CompanySettings {
    CompanySettings {
        id: row.id,
        company_name: row.company_name,
        company_name_en: row.company_name_en,
        tax_number: row.tax_number,
        commercial_register: row.commercial_register,
        address: row.address,
        phone: row.phone,
        email: row.email,
        currency: row.currency,
        currency_symbol: row.currency_symbol,
        tax_rate: Decimal::from_str(&row.tax_rate).unwrap_or(Decimal::ZERO),
        invoice_prefix: row.invoice_prefix,
        purchase_prefix: row.purchase_prefix,
        journal_prefix: row.journal_prefix,
        fiscal_year_start_month: row.fiscal_year_start_month as u32,
        logo_path: row.logo_path,
        purchase_warehouse_id: row.purchase_warehouse_id,
        sales_warehouse_id: row.sales_warehouse_id,
        numeral_system: row.numeral_system,
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    }
}
