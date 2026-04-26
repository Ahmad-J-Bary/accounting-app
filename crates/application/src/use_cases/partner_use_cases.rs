use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::shared::ids::PartnerId;
use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::unit_of_work::UnitOfWork;
use crate::errors::AppError;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
pub struct PartnerDto {
    pub id: u64,
    pub name: String,
    pub exchange_rate: String,
    pub amount_local: String,
    pub amount_usd: String,
    pub is_amount_in_usd: bool,
    pub profit_sharing_ratio: Option<String>,
    pub profit_sharing_type: String,
    pub linked_account_id: Option<String>,
    pub drawings_account_id: Option<String>,
}

impl From<Partner> for PartnerDto {
    fn from(p: Partner) -> Self {
        Self {
            id: p.id.0,
            name: p.name,
            exchange_rate: p.exchange_rate.to_string(),
            amount_local: p.amount_local.to_string(),
            amount_usd: p.amount_usd.to_string(),
            is_amount_in_usd: p.is_amount_in_usd,
            profit_sharing_ratio: p.profit_sharing_ratio.map(|r| r.to_string()),
            profit_sharing_type: match p.profit_sharing_type {
                ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal".to_string(),
                ProfitSharingType::BasedOnCapitalUSD => "BasedOnCapitalUSD".to_string(),
                ProfitSharingType::Manual => "Manual".to_string(),
            },
            linked_account_id: p.linked_account_id.map(|id| id.to_string()),
            drawings_account_id: p.drawings_account_id.map(|id| id.to_string()),
        }
    }
}

pub struct PartnerUseCases {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    uow: Arc<dyn UnitOfWork>,
}

impl PartnerUseCases {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        uow: Arc<dyn UnitOfWork>,
    ) -> Self {
        Self { repo, account_repo, uow }
    }

    pub async fn add_partner(
        &self,
        name: String,
        exchange_rate: Decimal,
        amount: Decimal,
        is_amount_in_usd: bool,
        sharing_type: String,
        manual_ratio: Option<Decimal>,
    ) -> Result<u64, AppError> {
        let sharing_enum = match sharing_type.as_str() {
            "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
            "BasedOnCapitalUSD" => ProfitSharingType::BasedOnCapitalUSD,
            "Manual" => ProfitSharingType::Manual,
            _ => return Err(AppError::Invalid("نوع تقاسم أرباح غير صالح".into())),
        };

        let mut partner = Partner::new(
            name.clone(),
            exchange_rate,
            amount,
            is_amount_in_usd,
            sharing_enum,
            manual_ratio,
        ).map_err(|e| AppError::Domain(e))?;

        // Start transaction
        self.uow.begin().await?;

        // 1. Create a corresponding account in CoA under Capital (Equity Group 222)
        let capital_parent = self.account_repo.find_by_code("222").await?
            .ok_or_else(|| AppError::Invalid("حساب رأس المال العام (222) غير موجود".into()))?;
        
        let existing_accounts = self.account_repo.list_all().await?;
        
        // Generate code for Capital account (e.g. 22201, 22202...)
        let cap_count = existing_accounts.iter().filter(|a| a.code.starts_with("222") && a.code.len() > 3).count();
        let cap_code = format!("222{:02}", cap_count + 1);

        let cap_account = Account::new(
            cap_code,
            format!("رأس مال - {}", name),
            format!("Capital - {}", name),
            AccountType::Equity,
            Some(capital_parent.id),
            AccountCategory::Detail,
            4, 
            partner.amount_local, 
            Some(format!("حساب رأس مال الشريك {}", name)),
        ).map_err(|e| AppError::Domain(e))?;

        self.account_repo.save(&cap_account).await?;
        
        // 2. Create Drawings account under parent group (44)
        let drawings_parent = self.account_repo.find_by_code("44").await?
            .ok_or_else(|| AppError::Invalid("حساب المسحوبات العام (44) غير موجود".into()))?;

        let draw_count = existing_accounts.iter().filter(|a| a.code.starts_with("44") && a.code.len() > 2).count();
        let draw_code = format!("44{:02}", draw_count + 1);

        let draw_account = Account::new(
            draw_code,
            format!("مسحوبات - {}", name),
            format!("Drawings - {}", name),
            AccountType::Expenses,
            Some(drawings_parent.id),
            AccountCategory::Detail,
            3, 
            Decimal::ZERO, 
            Some(format!("حساب مسحوبات الشريك {}", name)),
        ).map_err(|e| AppError::Domain(e))?;

        self.account_repo.save(&draw_account).await?;

        // 3. Link accounts to partner
        partner.link_account(cap_account.id);
        partner.link_drawings_account(draw_account.id);
        
        self.repo.save(&partner).await?;

        self.uow.commit().await?;

        Ok(partner.id.0)
    }

    pub async fn update_partner(
        &self,
        id: u64,
        name: String,
        exchange_rate: Decimal,
        amount: Decimal,
        is_amount_in_usd: bool,
        sharing_type: String,
        manual_ratio: Option<Decimal>,
    ) -> Result<(), AppError> {
        let partner_id = PartnerId::from_u64(id);
        let mut partner = self.repo.find_by_id(&partner_id).await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        let sharing_enum = match sharing_type.as_str() {
            "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
            "BasedOnCapitalUSD" => ProfitSharingType::BasedOnCapitalUSD,
            "Manual" => ProfitSharingType::Manual,
            _ => return Err(AppError::Invalid("نوع تقاسم أرباح غير صالح".into())),
        };

        partner.update_info(
            name,
            exchange_rate,
            amount,
            is_amount_in_usd,
            sharing_enum,
            manual_ratio,
        ).map_err(|e| AppError::Domain(e))?;

        self.uow.begin().await?;
        self.repo.update(&partner).await?;
        self.uow.commit().await?;

        Ok(())
    }

    pub async fn list_partners(&self) -> Result<Vec<PartnerDto>, AppError> {
        let partners = self.repo.list_all(false).await?;
        Ok(partners.into_iter().map(PartnerDto::from).collect())
    }

    pub async fn delete_partner(&self, id: u64) -> Result<(), AppError> {
        let partner_id = PartnerId::from_u64(id);
        let partner = self.repo.find_by_id(&partner_id).await?;
        
        if let Some(_p) = partner {
            self.uow.begin().await?;
            
            // Delete linked account if it exists and has no balance?
            // Actually, maybe we should just deactivate the partner.
            // For now, simple delete.
            self.repo.delete(&partner_id).await?;
            
            self.uow.commit().await?;
        }
        
        Ok(())
    }
}
