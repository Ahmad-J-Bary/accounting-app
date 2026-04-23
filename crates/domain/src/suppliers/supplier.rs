use crate::shared::errors::DomainError;
use crate::shared::ids::SupplierId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: SupplierId,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub balance: Decimal,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Supplier {
    pub fn new(
        name: String,
        phone: Option<String>,
        address: Option<String>,
    ) -> Result<Self, DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم المورد لا يمكن أن يكون فارغًا".into()));
        }
        let now = Utc::now();
        Ok(Self {
            id: SupplierId(Uuid::new_v4()),
            name,
            phone,
            address,
            balance: Decimal::ZERO,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn increase_balance(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.balance += amount;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn decrease_balance(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::Invalid("المبلغ يجب أن يكون موجبًا".into()));
        }
        self.balance -= amount;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn update_info(
        &mut self,
        name: String,
        phone: Option<String>,
        address: Option<String>,
    ) -> Result<(), DomainError> {
        if name.trim().is_empty() {
            return Err(DomainError::Invalid("اسم المورد لا يمكن أن يكون فارغًا".into()));
        }
        self.name = name;
        self.phone = phone;
        self.address = address;
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
