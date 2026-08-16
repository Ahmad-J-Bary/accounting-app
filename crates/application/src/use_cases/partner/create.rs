use std::sync::Arc;
use rust_decimal::Decimal;
use chrono::Utc;
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::settings::START_MODE_EXISTING;

use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::errors::AppError;

pub struct CreatePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
}

impl CreatePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
    ) -> Self {
        Self { repo, account_repo, currency_repo }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn execute(
        &self,
        name: String,
        currency_code: String,
        exchange_rate: Decimal,
        amount: Decimal,
        is_amount_in_original: bool,
        sharing_type: String,
        manual_ratio: Option<Decimal>,
        accounting_start_mode: String,
    ) -> Result<String, AppError> {
        let sharing_enum = match sharing_type.as_str() {
            "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
            "BasedOnCapitalOriginal" => ProfitSharingType::BasedOnCapitalOriginal,
            "Manual" => ProfitSharingType::Manual,
            _ => return Err(AppError::Invalid("نوع تقاسم أرباح غير صالح".into())),
        };

        // Get next partner code
        let next_seq = self.account_repo.get_next_child_code("51").await?;
        let numeric_part = if let Some(stripped) = next_seq.strip_prefix("51") {
            stripped
        } else {
            &next_seq
        };

        let code = format!("P{}", numeric_part);

        let base_currency = self.currency_repo.get_base_currency().await?
            .ok_or_else(|| AppError::Invalid("لم يتم تعيين العملة الأساسية".into()))?;
        let partner_currency = if is_amount_in_original {
            self.currency_repo.find_by_code(&currency_code).await?
                .ok_or_else(|| AppError::Invalid(format!("العملة {} غير موجودة", currency_code)))?
        } else {
            base_currency.clone()
        };

        let mut partner = Partner::new(
            code.clone(),
            name.clone(),
            partner_currency,
            exchange_rate,
            amount,
            is_amount_in_original,
            sharing_enum,
            manual_ratio,
        ).map_err(AppError::Domain)?;

        let capital_parent = self.account_repo.find_by_code("51").await?
            .ok_or_else(|| AppError::Invalid("حساب رأس المال العام (51) غير موجود".into()))?;
        
        let cap_code = format!("51{}", &code[1..]); 
        let cap_account_id = domain::shared::ids::AccountId::new();

        // For an existing-company migration the partner capital is recorded as
        // the account's opening balance (no journal). For a new company it is
        // recorded through an explicit capital-contribution journal instead, so
        // the static balance must stay zero to avoid double counting.
        let capital_amount = if accounting_start_mode == START_MODE_EXISTING {
            partner.amount_local
        } else {
            Decimal::ZERO
        };

        let cap_account = Account {
            id: cap_account_id,
            code: cap_code,
            name_ar: name.clone(),
            name_en: name.clone(),
            account_type: AccountType::Equity,
            parent_id: Some(capital_parent.id),
            category: AccountCategory::Detail,
            level: 3,
            opening_balance: capital_amount,
            balance: capital_amount,
            debit: Decimal::ZERO,
            credit: Decimal::ZERO,
            currency: partner.currency.clone(),
            exchange_rate: partner.exchange_rate,
            notes: Some(format!("حساب رأس مال الشريك {}", name)),
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: None,
            purpose: domain::accounting::account::AccountPurpose::PartnerCapital,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        let drawings_parent = self.account_repo.find_by_code("44").await?
            .ok_or_else(|| AppError::Invalid("حساب المسحوبات العام (44) غير موجود".into()))?;

        let draw_code = format!("44{}", &code[1..]);
        let draw_account_name = format!("مسحوبات {}", name);

        // Partner drawings are a contra-equity (owner-current) balance that must
        // NEVER be treated as an operating expense in the P&L (Sec 11 / Sec 31).
        // Reclassified to a Debit-normal Equity-side accounts under chart "44".
        let draw_account = Account {
            id: domain::shared::ids::AccountId::new(),
            code: draw_code,
            name_ar: draw_account_name.clone(),
            name_en: draw_account_name.clone(),
            account_type: AccountType::Equity,
            parent_id: Some(drawings_parent.id),
            category: AccountCategory::Detail,
            level: 3,
            opening_balance: Decimal::ZERO,
            balance: Decimal::ZERO,
            debit: Decimal::ZERO,
            credit: Decimal::ZERO,
            currency: partner.currency.clone(),
            exchange_rate: partner.exchange_rate,
            notes: Some(format!("حساب مسحوبات الشريك {}", name)),
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: None,
            purpose: domain::accounting::account::AccountPurpose::PartnerDrawings,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Per-partner current/profit account (Sec 4 / Sec 13 / Sec 37):
        // accumulated profit allocations live here, separate from registered
        // capital, so the equity statement can show (capital + current −
        // drawings) without deriving profit as ledger − registered capital.
        let current_parent = self.account_repo.find_by_code("54").await?
            .ok_or_else(|| AppError::Invalid("حساب الجارية للشركاء (54) غير موجود".into()))?;

        let current_code = format!("54{}", &code[1..]);
        let current_name = format!("حساب جاري {}", name);
        let current_account = Account {
            id: domain::shared::ids::AccountId::new(),
            code: current_code,
            name_ar: current_name.clone(),
            name_en: current_name.clone(),
            account_type: AccountType::Equity,
            parent_id: Some(current_parent.id),
            category: AccountCategory::Detail,
            level: 3,
            opening_balance: Decimal::ZERO,
            balance: Decimal::ZERO,
            debit: Decimal::ZERO,
            credit: Decimal::ZERO,
            currency: partner.currency.clone(),
            exchange_rate: partner.exchange_rate,
            notes: Some(format!("الحساب الجاري للشريك {}", name)),
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: None,
            purpose: domain::accounting::account::AccountPurpose::PartnerCurrent,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        partner.link_account(cap_account.id);
        partner.link_drawings_account(draw_account.id);
        partner.link_current_account(current_account.id);

        // Partner + its three accounts persist in ONE transaction (Sec 14 / Sec 29).
        self.repo.save_with_accounts(&partner, &cap_account, &draw_account, Some(&current_account)).await?;

        Ok(partner.id.to_string())
    }
}
