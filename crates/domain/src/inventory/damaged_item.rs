use crate::shared::errors::DomainError;
use crate::shared::ids::{DamagedItemId, MaterialId};
use crate::shared::{Currency, Money, MonetaryAmount};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageFinancialSnapshot {
    pub currency_code: String,
    pub fx_rate: Decimal,
    pub cost_impact: Decimal,
    pub cost_impact_base: Decimal,
    pub loss: Decimal,
    pub loss_base: Decimal,
}

impl DamageFinancialSnapshot {
    pub fn full_damage(
        amount: MonetaryAmount,
        base_currency: &Currency,
    ) -> Result<Self, DomainError> {
        let currency_code = amount.currency().code.clone();
        if currency_code.trim().is_empty() {
            return Err(DomainError::Invalid("عملة التالف لا يمكن أن تكون فارغة".into()));
        }
        if amount.fx_rate <= Decimal::ZERO {
            return Err(DomainError::Invalid("سعر الصرف يجب أن يكون أكبر من صفر".into()));
        }
        if amount.amount() < Decimal::ZERO || amount.base_amount < Decimal::ZERO {
            return Err(DomainError::Invalid("مبالغ التالف لا يمكن أن تكون سالبة".into()));
        }
        let _ = MonetaryAmount::new(
            Money::new(amount.amount(), Currency::new(
                &currency_code,
                &currency_code,
                &currency_code,
                &currency_code,
                base_currency.decimals,
                currency_code == base_currency.code,
            )),
            amount.fx_rate,
        );
        Ok(Self {
            currency_code,
            fx_rate: amount.fx_rate,
            cost_impact: amount.amount(),
            cost_impact_base: amount.base_amount,
            loss: amount.amount(),
            loss_base: amount.base_amount,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamagedItem {
    pub id: DamagedItemId,
    pub material_id: MaterialId,
    pub quantity: Decimal,
    pub reason: Option<String>,
    pub damage_date: DateTime<Utc>,
    pub financials: DamageFinancialSnapshot,
    pub notes: Option<String>,
    pub reference: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl DamagedItem {
    pub fn new(
        material_id: MaterialId,
        quantity: Decimal,
        reason: Option<String>,
        damage_date: DateTime<Utc>,
        financials: DamageFinancialSnapshot,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if quantity <= Decimal::ZERO {
            return Err(DomainError::Invalid("كمية التالف يجب أن تكون موجبة".into()));
        }
        if financials.cost_impact < Decimal::ZERO
            || financials.cost_impact_base < Decimal::ZERO
            || financials.loss < Decimal::ZERO
            || financials.loss_base < Decimal::ZERO
        {
            return Err(DomainError::Invalid("قيمة التكلفة لا يمكن أن تكون سالبة".into()));
        }
        Ok(Self {
            id: DamagedItemId(Uuid::new_v4()),
            material_id,
            quantity,
            reason,
            damage_date,
            financials,
            notes,
            reference: None,
            created_at: Utc::now(),
        })
    }

    pub fn cost_impact(&self) -> Decimal {
        self.financials.cost_impact
    }

    pub fn cost_impact_base(&self) -> Decimal {
        self.financials.cost_impact_base
    }

    pub fn loss(&self) -> Decimal {
        self.financials.loss
    }

    pub fn loss_base(&self) -> Decimal {
        self.financials.loss_base
    }
}
