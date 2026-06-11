use std::sync::Arc;
use crate::ports::settings_repository::SettingsRepository;
use crate::dto::settings_dto::{CompanySettingsDto};
use crate::errors::AppError;

pub struct SettingsQueries {
    repo: Arc<dyn SettingsRepository>,
}

impl SettingsQueries {
    pub fn new(repo: Arc<dyn SettingsRepository>) -> Self {
        Self { repo }
    }

    pub async fn get(&self) -> Result<CompanySettingsDto, AppError> {
        let settings = self.repo.get().await?;
        Ok(to_dto(settings))
    }
}

pub fn to_dto(s: domain::settings::CompanySettings) -> CompanySettingsDto {
    CompanySettingsDto {
        id: s.id,
        company_name: s.company_name,
        company_name_en: s.company_name_en,
        tax_number: s.tax_number,
        commercial_register: s.commercial_register,
        address: s.address,
        phone: s.phone,
        email: s.email,
        currency: s.currency,
        currency_symbol: s.currency_symbol,
        tax_rate: s.tax_rate.to_string(),
        invoice_prefix: s.invoice_prefix,
        purchase_prefix: s.purchase_prefix,
        journal_prefix: s.journal_prefix,
        fiscal_year_start_month: s.fiscal_year_start_month,
        logo_path: s.logo_path,
        purchase_warehouse_id: s.purchase_warehouse_id,
        sales_warehouse_id: s.sales_warehouse_id,
        updated_at: s.updated_at.to_rfc3339(),
    }
}
