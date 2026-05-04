use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::ops::{Add, Sub, Mul};
use crate::shared::currency::Currency;
use crate::shared::money::Money;
use crate::shared::errors::DomainError;

/// A comprehensive monetary value that stores both the original entry 
/// and its equivalent in the system's reference base currency.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MonetaryAmount {
    /// The amount in the original currency as entered by the user.
    pub original: Money,
    
    /// The equivalent amount in the system's base currency (e.g., USD).
    pub base_amount: Decimal,
    
    /// The exchange rate used at the time of entry.
    /// Formula: base_amount = original.amount * fx_rate
    pub fx_rate: Decimal,
}

impl MonetaryAmount {
    pub fn new(original: Money, fx_rate: Decimal) -> Self {
        let base_amount = original.to_base(fx_rate);
        Self {
            original,
            base_amount,
            fx_rate,
        }
    }

    /// Create a MonetaryAmount where the original currency IS the base currency.
    pub fn from_base(amount: Decimal, base_currency: Currency) -> Self {
        Self {
            original: Money::new(amount, base_currency),
            base_amount: amount,
            fx_rate: Decimal::ONE,
        }
    }

    pub fn zero(base_currency: Currency) -> Self {
        Self::from_base(Decimal::ZERO, base_currency)
    }

    pub fn amount(&self) -> Decimal {
        self.original.amount()
    }

    pub fn currency(&self) -> &Currency {
        self.original.currency()
    }

    pub fn is_zero(&self) -> bool {
        self.original.is_zero()
    }
}

impl Add for MonetaryAmount {
    type Output = Result<Self, DomainError>;

    fn add(self, other: Self) -> Result<Self, DomainError> {
        if self.original.currency().code != other.original.currency().code {
            return Err(DomainError::Invalid("Cannot add MonetaryAmounts with different original currencies".into()));
        }
        
        // Fx rates should be consistent if currencies are the same
        Ok(Self {
            original: self.original + other.original,
            base_amount: self.base_amount + other.base_amount,
            fx_rate: self.fx_rate,
        })
    }
}

impl Sub for MonetaryAmount {
    type Output = Result<Self, DomainError>;

    fn sub(self, other: Self) -> Result<Self, DomainError> {
        if self.original.currency().code != other.original.currency().code {
            return Err(DomainError::Invalid("Cannot subtract MonetaryAmounts with different original currencies".into()));
        }
        
        Ok(Self {
            original: self.original - other.original,
            base_amount: self.base_amount - other.base_amount,
            fx_rate: self.fx_rate,
        })
    }
}

impl Mul<Decimal> for MonetaryAmount {
    type Output = Self;

    fn mul(self, rhs: Decimal) -> Self {
        Self {
            original: self.original * rhs,
            base_amount: self.base_amount * rhs,
            fx_rate: self.fx_rate,
        }
    }
}
