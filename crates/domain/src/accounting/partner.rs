#![allow(clippy::too_many_arguments)]
use crate::shared::currency::Currency;
use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, PartnerId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProfitSharingType {
    BasedOnCapitalLocal,    // نسبة المشاركة بالأرباح = نسبة المشاركة برأس المال
    BasedOnCapitalOriginal, // نسبة المشاركة بالأرباح = نسبة المشاركة برأس المال الأصلي
    Manual,                 // تحديد نسبة المشاركة بالأرباح بشكل يدوي
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Partner {
    pub id: PartnerId,
    pub code: String,
    pub name: String,
    pub currency: Currency,
    pub exchange_rate: Decimal,
    pub amount_local: Decimal,
    pub amount_original: Decimal,
    pub is_amount_in_original: bool,
    pub profit_sharing_ratio: Option<Decimal>,
    pub profit_sharing_type: ProfitSharingType,
    pub linked_account_id: Option<AccountId>,
    pub drawings_account_id: Option<AccountId>,
    /// Per-partner current/profit account (accumulated profit allocations),
    /// separate from the capital account (Sec 4 / Sec 13).
    pub current_account_id: Option<AccountId>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Partner {
    pub fn new(
        code: String,
        name: String,
        currency: Currency,
        exchange_rate: Decimal,
        amount: Decimal,
        is_amount_in_original: bool,
        profit_sharing_type: ProfitSharingType,
        profit_sharing_ratio: Option<Decimal>,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم الشريك لا يمكن أن يكون فارغًا".into(),
            ));
        }

        if exchange_rate <= Decimal::ZERO {
            return Err(DomainError::Invalid(
                "سعر الصرف يجب أن يكون أكبر من الصفر".into(),
            ));
        }

        // FX convention (matches `Money::to_base` and the rest of the app):
        // 1 base currency = `exchange_rate` units of the partner currency.
        // So a partner-currency (original) amount is converted to base by
        // DIVIDING, and a base (local) amount to the partner currency by
        // MULTIPLYING.
        let (amount_local, amount_original) = if is_amount_in_original {
            (amount / exchange_rate, amount)
        } else {
            (amount, amount * exchange_rate)
        };

        let now = Utc::now();

        Ok(Self {
            id: PartnerId::new(),
            code,
            name,
            currency,
            exchange_rate,
            amount_local,
            amount_original,
            is_amount_in_original,
            profit_sharing_ratio,
            profit_sharing_type,
            linked_account_id: None,
            drawings_account_id: None,
            current_account_id: None,
            notes,
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
        is_amount_in_original: bool,
        profit_sharing_type: ProfitSharingType,
        profit_sharing_ratio: Option<Decimal>,
        notes: Option<String>,
    ) -> Result<(), DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم الشريك لا يمكن أن يكون فارغًا".into(),
            ));
        }

        self.code = code;
        self.name = name;
        self.exchange_rate = exchange_rate;
        self.is_amount_in_original = is_amount_in_original;

        // FX convention (matches `Money::to_base`): 1 base = `exchange_rate`
        // partner units, so original→base divides, base→original multiplies.
        let (amount_local, amount_original) = if is_amount_in_original {
            (amount / exchange_rate, amount)
        } else {
            (amount, amount * exchange_rate)
        };

        self.amount_local = amount_local;
        self.amount_original = amount_original;
        self.profit_sharing_type = profit_sharing_type;
        self.profit_sharing_ratio = profit_sharing_ratio;
        self.notes = notes;
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

    pub fn link_current_account(&mut self, account_id: AccountId) {
        self.current_account_id = Some(account_id);
        self.updated_at = Utc::now();
    }
}
