use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::settings_repository::SettingsRepository;
use domain::settings::CompanySettings;
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::DateTime;

pub struct SqliteSettingsRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteSettingsRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct SettingsRow {
    id: String,
    company_name: String,
    company_name_en: Option<String>,
    tax_number: Option<String>,
    commercial_register: Option<String>,
    address: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    currency: String,
    currency_symbol: String,
    tax_rate: String,
    invoice_prefix: String,
    purchase_prefix: String,
    journal_prefix: String,
    fiscal_year_start_month: i64,
    logo_path: Option<String>,
    updated_at: String,
}

#[async_trait]
impl SettingsRepository for SqliteSettingsRepository {
    async fn get(&self) -> Result<CompanySettings, AppError> {
        let row = sqlx::query_as::<_, SettingsRow>(
            "SELECT id, company_name, company_name_en, tax_number, commercial_register,
             address, phone, email, currency, currency_symbol, tax_rate,
             invoice_prefix, purchase_prefix, journal_prefix, fiscal_year_start_month,
             logo_path, updated_at FROM settings LIMIT 1"
        )
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = row {
            Ok(CompanySettings {
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
                updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now()),
            })
        } else {
            Ok(CompanySettings::default())
        }
    }

    async fn save(&self, settings: &CompanySettings) -> Result<(), AppError> {
        sqlx::query(
            "INSERT OR REPLACE INTO settings (id, company_name, company_name_en, tax_number, commercial_register,
             address, phone, email, currency, currency_symbol, tax_rate,
             invoice_prefix, purchase_prefix, journal_prefix, fiscal_year_start_month, logo_path, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        .bind(settings.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

