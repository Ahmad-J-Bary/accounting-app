use sqlx::SqlitePool;
use application::errors::AppError;
use domain::settings::CompanySettings;

pub async fn save(pool: &SqlitePool, settings: &CompanySettings) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO settings (id, company_name, company_name_en, tax_number, commercial_register,
         address, phone, email, currency, currency_symbol, tax_rate,
         invoice_prefix, purchase_prefix, journal_prefix, fiscal_year_start_month, logo_path,
         purchase_warehouse_id, sales_warehouse_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&settings.id)
    .bind(&settings.company_name)
    .bind(&settings.company_name_en)
    .bind(&settings.tax_number)
    .bind(&settings.commercial_register)
    .bind(&settings.address)
    .bind(&settings.phone)
    .bind(&settings.email)
    .bind(&settings.currency)
    .bind(&settings.currency_symbol)
    .bind(settings.tax_rate.to_string())
    .bind(&settings.invoice_prefix)
    .bind(&settings.purchase_prefix)
    .bind(&settings.journal_prefix)
    .bind(settings.fiscal_year_start_month as i64)
    .bind(&settings.logo_path)
    .bind(&settings.purchase_warehouse_id)
    .bind(&settings.sales_warehouse_id)
    .bind(settings.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
