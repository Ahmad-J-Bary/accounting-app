use std::sync::Arc;
use std::str::FromStr;
use rust_decimal::Decimal;
use domain::settings::{START_MODE_EXISTING, START_MODE_NEW};
use crate::ports::settings_repository::SettingsRepository;
use crate::dto::settings_dto::{CompanySettingsDto, UpdateSettingsRequest};
use crate::errors::AppError;
use super::queries::to_dto;

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
        settings.purchase_warehouse_id = req.purchase_warehouse_id;
        settings.sales_warehouse_id = req.sales_warehouse_id;
        settings.numeral_system = req.numeral_system;
        if let Some(mode) = req.accounting_start_mode {
            if mode != START_MODE_NEW && mode != START_MODE_EXISTING {
                return Err(AppError::Invalid("طريقة بدء المحاسبة غير صالحة".into()));
            }
            settings.accounting_start_mode = mode;
        }
        settings.updated_at = chrono::Utc::now();
        self.repo.save(&settings).await?;
        Ok(to_dto(settings))
    }
}
