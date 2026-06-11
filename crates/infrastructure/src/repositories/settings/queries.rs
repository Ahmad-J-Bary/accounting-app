use sqlx::SqlitePool;
use application::errors::AppError;
use domain::settings::CompanySettings;
use super::models::SettingsRow;
use super::mappers::row_to_settings;

pub async fn get(pool: &SqlitePool) -> Result<CompanySettings, AppError> {
    let row = sqlx::query_as::<_, SettingsRow>(
        "SELECT id, company_name, company_name_en, tax_number, commercial_register,
         address, phone, email, currency, currency_symbol, tax_rate,
         invoice_prefix, purchase_prefix, journal_prefix, fiscal_year_start_month,
         logo_path, purchase_warehouse_id, sales_warehouse_id, updated_at FROM settings LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(row) = row {
        Ok(row_to_settings(row))
    } else {
        Ok(CompanySettings::default())
    }
}
