use crate::shared::ids::{PartnerId, AccountId};
use crate::shared::errors::DomainError;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProfitSharingType {
    BasedOnCapitalLocal, // نسبة المشاركة بالأرباح = نسبة المشاركة برأس المال
    BasedOnCapitalUSD,   // نسبة المشاركة بالأرباح = نسبة المشاركة برأس المال بالدولار
    Manual,              // تحديد نسبة المشاركة بالأرباح بشكل يدوي
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Partner {
    pub id: PartnerId,
    pub code: String,
    pub name: String,
    pub exchange_rate: Decimal,
    pub amount_local: Decimal,
    pub amount_usd: Decimal,
    pub is_amount_in_usd: bool,
    pub profit_sharing_ratio: Option<Decimal>,
    pub profit_sharing_type: ProfitSharingType,
    pub linked_account_id: Option<AccountId>,
    pub drawings_account_id: Option<AccountId>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Partner {
    pub fn new(
        code: String,
        name: String,
        exchange_rate: Decimal,
        amount: Decimal,
        is_amount_in_usd: bool,
        profit_sharing_type: ProfitSharingType,
        profit_sharing_ratio: Option<Decimal>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم الشريك لا يمكن أن يكون فارغًا".into()));
        }

        if exchange_rate <= Decimal::ZERO {
            return Err(DomainError::Invalid("سعر الصرف يجب أن يكون أكبر من الصفر".into()));
        }

        let (amount_local, amount_usd) = if is_amount_in_usd {
            (amount * exchange_rate, amount)
        } else {
            (amount, amount / exchange_rate)
        };

        let now = Utc::now();

        Ok(Self {
            id: PartnerId::new(),
            code,
            name,
            exchange_rate,
            amount_local,
            amount_usd,
            is_amount_in_usd,
            profit_sharing_ratio,
            profit_sharing_type,
            linked_account_id: None,
            drawings_account_id: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_info(
        &mut self,
        code: String,
        name: String,
        exchange_rate: Decimal,
        amount: Decimal,
        is_amount_in_usd: bool,
        profit_sharing_type: ProfitSharingType,
        profit_sharing_ratio: Option<Decimal>,
    ) -> Result<(), DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم الشريك لا يمكن أن يكون فارغًا".into()));
        }

        self.code = code;
        self.name = name;
        self.exchange_rate = exchange_rate;
        self.is_amount_in_usd = is_amount_in_usd;
        
        let (amount_local, amount_usd) = if is_amount_in_usd {
            (amount * exchange_rate, amount)
        } else {
            (amount, amount / exchange_rate)
        };
        
        self.amount_local = amount_local;
        self.amount_usd = amount_usd;
        self.profit_sharing_type = profit_sharing_type;
        self.profit_sharing_ratio = profit_sharing_ratio;
        self.updated_at = Utc::now();
        
        Ok(())
    }

    pub fn link_account(&mut self, account_id: AccountId) {
        self.linked_account_id = Some(account_id);
        self.updated_at = Utc::now();
    }

    pub fn link_drawings_account(&mut self, account_id: AccountId) {
        self.drawings_account_id = Some(account_id);
        self.updated_at = Utc::now();
    }
}
