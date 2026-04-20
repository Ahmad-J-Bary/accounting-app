use std::sync::Arc;
use crate::ports::settings_repository::SettingsRepository;
use crate::dto::settings_dto::{CompanySettingsDto, UpdateSettingsRequest};
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;

fn to_dto(s: domain::settings::CompanySettings) -> CompanySettingsDto {
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
        updated_at: s.updated_at.to_rfc3339(),
    }
}

pub struct GetSettingsUseCase {
    repo: Arc<dyn SettingsRepository>,
}

impl GetSettingsUseCase {
    pub fn new(repo: Arc<dyn SettingsRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<CompanySettingsDto, AppError> {
        let settings = self.repo.get().await?;
        Ok(to_dto(settings))
    }
}

pub struct UpdateSettingsUseCase {
    repo: Arc<dyn SettingsRepository>,
}

impl UpdateSettingsUseCase {
    pub fn new(repo: Arc<dyn SettingsRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: UpdateSettingsRequest) -> Result<CompanySettingsDto, AppError> {
        let mut settings = self.repo.get().await?;
        settings.company_name = req.company_name;
        settings.company_name_en = req.company_name_en;
        settings.tax_number = req.tax_number;
        settings.commercial_register = req.commercial_register;
        settings.address = req.address;
        settings.phone = req.phone;
        settings.email = req.email;
        settings.currency = req.currency;
        settings.currency_symbol = req.currency_symbol;
        settings.tax_rate = Decimal::from_str(&req.tax_rate.to_string())
            .unwrap_or(Decimal::ZERO);
        settings.invoice_prefix = req.invoice_prefix;
        settings.purchase_prefix = req.purchase_prefix;
        settings.journal_prefix = req.journal_prefix;
        settings.fiscal_year_start_month = req.fiscal_year_start_month;
        settings.updated_at = chrono::Utc::now();
        self.repo.save(&settings).await?;
        Ok(to_dto(settings))
    }
}
