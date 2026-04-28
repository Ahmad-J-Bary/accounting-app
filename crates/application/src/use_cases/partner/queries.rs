use std::sync::Arc;
use domain::accounting::partner::{Partner, ProfitSharingType};
use crate::ports::partner_repository::PartnerRepository;
use crate::errors::AppError;
use serde::{Deserialize, Serialize};

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

pub struct PartnerQueries {
    repo: Arc<dyn PartnerRepository>,
}

impl PartnerQueries {
    pub fn new(repo: Arc<dyn PartnerRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_partners(&self) -> Result<Vec<PartnerDto>, AppError> {
        let partners = self.repo.list_all(false).await?;
        Ok(partners.into_iter().map(PartnerDto::from).collect())
    }
}
