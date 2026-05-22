use std::sync::Arc;
use rust_decimal::Decimal;
use chrono::Utc;
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, Money, MonetaryAmount};

use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::unit_of_work::UnitOfWork;
use crate::errors::AppError;

pub struct CreatePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    uow: Arc<dyn UnitOfWork>,
}

impl CreatePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        uow: Arc<dyn UnitOfWork>,
    ) -> Self {
        Self { repo, account_repo, journal_repo, uow }
    }

    pub async fn execute(
        &self,
        name: String,
        exchange_rate: Decimal,
        amount: Decimal,
        is_amount_in_usd: bool,
        sharing_type: String,
        manual_ratio: Option<Decimal>,
    ) -> Result<String, AppError> {
        let sharing_enum = match sharing_type.as_str() {
            "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
            "BasedOnCapitalUSD" => ProfitSharingType::BasedOnCapitalUSD,
            "Manual" => ProfitSharingType::Manual,
            _ => return Err(AppError::Invalid("نوع تقاسم أرباح غير صالح".into())),
        };

        // Get next partner code
        let next_seq = self.account_repo.get_next_child_code("222").await?;
        let numeric_part = if let Some(stripped) = next_seq.strip_prefix("222") {
            stripped
        } else {
            &next_seq
        };

        let code = format!("P{}", numeric_part);

        let mut partner = Partner::new(
            code.clone(),
            name.clone(),
            exchange_rate,
            amount,
            is_amount_in_usd,
            sharing_enum,
            manual_ratio,
        ).map_err(AppError::Domain)?;

        self.uow.begin().await?;

        let capital_parent = self.account_repo.find_by_code("222").await?
            .ok_or_else(|| AppError::Invalid("حساب رأس المال العام (222) غير موجود".into()))?;
        
        let cap_code = format!("222{}", &code[1..]); 
        let cap_account_id = domain::shared::ids::AccountId::new();

        let cap_account = Account {
            id: cap_account_id,
            code: cap_code,
            name_ar: name.clone(),
            name_en: name.clone(),
            account_type: AccountType::Equity,
            parent_id: Some(capital_parent.id),
            category: AccountCategory::Detail,
            level: 4,
            opening_balance: partner.amount_local,
            balance: partner.amount_local,
            debit: Decimal::ZERO,
            credit: Decimal::ZERO,
            notes: Some(format!("حساب رأس مال الشريك {}", name)),
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo.save(&cap_account).await?;
        
        let drawings_parent = self.account_repo.find_by_code("44").await?
            .ok_or_else(|| AppError::Invalid("حساب المسحوبات العام (44) غير موجود".into()))?;

        let draw_code = format!("44{}", &code[1..]);
        let draw_account_name = format!("مسحوبات {}", name);
        
        let draw_account = Account {
            id: domain::shared::ids::AccountId::new(),
            code: draw_code,
            name_ar: draw_account_name.clone(),
            name_en: draw_account_name.clone(),
            account_type: AccountType::Expenses,
            parent_id: Some(drawings_parent.id),
            category: AccountCategory::Detail,
            level: 3,
            opening_balance: Decimal::ZERO,
            balance: Decimal::ZERO,
            debit: Decimal::ZERO,
            credit: Decimal::ZERO,
            notes: Some(format!("حساب مسحوبات الشريك {}", name)),
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo.save(&draw_account).await?;

        partner.link_account(cap_account.id);
        partner.link_drawings_account(draw_account.id);
        
        self.repo.save(&partner).await?;

        // --- Consolidated Capital Journal Entry ---
        // Delete any existing consolidated capital entry
        if let Ok(Some(old_entry)) = self.journal_repo.find_by_source_id("consolidated_capital").await {
            self.journal_repo.delete(&old_entry.id).await?;
        }

        // Compute total capital from ALL partners
        let all_partners = self.repo.list_all(true).await?;
        let mut total_local = Decimal::ZERO;
        let mut total_usd = Decimal::ZERO;
        for p in &all_partners {
            total_local += p.amount_local;
            total_usd += p.amount_usd;
        }

        if total_local > Decimal::ZERO || total_usd > Decimal::ZERO {
            let cash_account = self.account_repo.find_by_code("122").await?
                .ok_or_else(|| AppError::NotFound("حساب الصندوق (الخزينة) (122) غير موجود".into()))?;

            let capital_parent = self.account_repo.find_by_code("222").await?
                .ok_or_else(|| AppError::Invalid("حساب رأس المال العام (222) غير موجود".into()))?;

            let fx_rate = if exchange_rate > Decimal::ZERO { exchange_rate } else { Decimal::ONE };
            let total_ma = if is_amount_in_usd || total_usd > Decimal::ZERO {
                MonetaryAmount::new(Money::new(total_usd.abs(), Currency::new("USD", "USD", "USD", "", 2, false)), fx_rate)
            } else {
                MonetaryAmount::new(Money::new(total_local.abs(), Currency::new("SYP", "SYP", "SYP", "", 2, false)), fx_rate)
            };
            let zero_ma = MonetaryAmount::zero(total_ma.currency().clone());

            let lines = vec![
                JournalLine::new(cash_account.id, total_ma.clone(), zero_ma.clone(),
                    format!("إيداع رأس المال بالصندوق")),
                JournalLine::new(capital_parent.id, zero_ma, total_ma,
                    format!("إجمالي رأس مال الشركاء")),
            ];

            let mut entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                JournalType::CashOpeningBalance,
                lines,
                Utc::now(),
                format!("إيداع رأس المال بالصندوق — إجمالي رأس مال الشركاء"),
                Some("consolidated_capital".to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        self.uow.commit().await?;

        Ok(partner.id.to_string())
    }
}
