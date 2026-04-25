use crate::shared::errors::DomainError;
use crate::shared::ids::{AccountId, SupplierId};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use crate::shared::currency::Currency;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: SupplierId,
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

impl Supplier {
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
            return Err(DomainError::Invalid("اسم المورد لا يمكن أن يكون فارغًا".into()));
        }
        if code.trim().is_empty() {
            return Err(DomainError::Invalid("كود المورد لا يمكن أن يكون فارغًا".into()));
        }
        if debit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ المدين لا يمكن أن يكون سالبًا".into()));
        }
        if credit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدائن لا يمكن أن يكون سالبًا".into()));
        }

        let now = Utc::now();
        // For a supplier (A/P): balance = credit - debit
        // Positive = we owe supplier, Negative = supplier owes us (advance)
        let balance = credit - debit;

        Ok(Self {
            id: SupplierId::new(),
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

    /// Create supplier with a specific ID (for synchronization with chart of accounts)
    pub fn new_with_id(
        id: SupplierId,
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
            return Err(DomainError::Invalid("اسم المورد لا يمكن أن يكون فارغًا".into()));
        }
        if code.trim().is_empty() {
            return Err(DomainError::Invalid("كود المورد لا يمكن أن يكون فارغًا".into()));
        }
        if debit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ المدين لا يمكن أن يكون سالبًا".into()));
        }
        if credit < Decimal::ZERO {
            return Err(DomainError::Invalid("مبلغ الدائن لا يمكن أن يكون سالبًا".into()));
        }

        let now = Utc::now();
        let balance = credit - debit;

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

    /// الرصيد الفعلي = الدائن - المدين (للمورد: الموجب يعني نحن مدينون له)
    pub fn effective_balance(&self) -> Decimal {
        self.credit - self.debit
    }

    /// هل نحن مدينون للمورد؟
    pub fn is_payable(&self) -> bool {
        self.credit > self.debit
    }

    /// هل للمورد رصيد مدين (دفع مقدم لنا)؟
    pub fn has_debit_balance(&self) -> bool {
        self.debit > self.credit
    }

    pub fn increase_debit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.debit += amount;
        self.balance = self.credit - self.debit;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn increase_credit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.credit += amount;
        self.balance = self.credit - self.debit;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn increase_balance(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.credit += amount;
        self.balance = self.credit - self.debit;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn decrease_balance(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.debit += amount;
        self.balance = self.credit - self.debit;
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
            return Err(DomainError::Invalid("اسم المورد لا يمكن أن يكون فارغًا".into()));
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
