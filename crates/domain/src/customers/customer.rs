use crate::shared::currency::Currency;
use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, CustomerId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Customer {
    pub id: CustomerId,
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub account_id: Option<AccountId>,
    pub debit: Decimal,
    pub credit: Decimal,
    pub opening_balance: Decimal,
    pub balance: Decimal,
    pub currency: Currency,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Customer {
    pub fn new(
        code: String,
        name: String,
        phone: Option<String>,
        address: Option<String>,
        account_id: Option<AccountId>,
        debit: Decimal,
        credit: Decimal,
        opening_balance: Decimal,
        currency: Currency,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم العميل لا يمكن أن يكون فارغًا".into()));
        }
        if code.trim().is_empty() {
            return Err(DomainError::Invalid("كود العميل لا يمكن أن يكون فارغًا".into()));
        }
        if debit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ المدين لا يمكن أن يكون سالبًا".into()));
        }
        if credit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدائن لا يمكن أن يكون سالبًا".into()));
        }

        let now = Utc::now();
        // For a customer (A/R): balance = debit - credit
        // Positive = customer owes us, Negative = we owe customer (advance payment)
        let balance = debit - credit;

        Ok(Self {
            id: CustomerId::new(),
            code,
            name,
            phone,
            address,
            account_id,
            debit,
            credit,
            opening_balance,
            balance,
            currency,
            notes,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    /// Create customer with a specific ID (for synchronization with chart of accounts)
    pub fn new_with_id(
        id: CustomerId,
        code: String,
        name: String,
        phone: Option<String>,
        address: Option<String>,
        account_id: Option<AccountId>,
        debit: Decimal,
        credit: Decimal,
        opening_balance: Decimal,
        currency: Currency,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم العميل لا يمكن أن يكون فارغًا".into()));
        }
        if code.trim().is_empty() {
            return Err(DomainError::Invalid("كود العميل لا يمكن أن يكون فارغًا".into()));
        }
        if debit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ المدين لا يمكن أن يكون سالبًا".into()));
        }
        if credit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدائن لا يمكن أن يكون سالبًا".into()));
        }

        let now = Utc::now();
        let balance = debit - credit;

        Ok(Self {
            id,
            code,
            name,
            phone,
            address,
            account_id,
            debit,
            credit,
            opening_balance,
            balance,
            currency,
            notes,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    /// الرصيد الفعلي = المدين - الدائن (للعميل: الموجب يعني مدين لنا)
    pub fn effective_balance(&self) -> Decimal {
        self.debit - self.credit
    }

    /// هل العميل مدين لنا؟
    pub fn is_debtor(&self) -> bool {
        self.debit > self.credit
    }

    /// هل للعميل رصيد دائن (دفع مقدم)؟
    pub fn has_credit_balance(&self) -> bool {
        self.credit > self.debit
    }

    pub fn increase_debit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.debit += amount;
        self.balance = self.debit - self.credit;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn increase_credit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.credit += amount;
        self.balance = self.debit - self.credit;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn increase_balance(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.debit += amount;
        self.balance = self.debit - self.credit;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn decrease_balance(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.credit += amount;
        self.balance = self.debit - self.credit;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn link_account(&mut self, account_id: AccountId) {
        self.account_id = Some(account_id);
        self.updated_at = Utc::now();
    }

    pub fn update_info(
        &mut self,
        name: String,
        phone: Option<String>,
        address: Option<String>,
        notes: Option<String>,
    ) -> Result<(), DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم العميل لا يمكن أن يكون فارغًا".into()));
        }
        self.name = name;
        self.phone = phone;
        self.address = address;
        self.notes = notes;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }
}
