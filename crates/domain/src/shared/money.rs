use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::ops::{Add, Mul, Sub};

use crate::shared::currency::Currency;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Money {
    amount: Decimal,
    currency: Currency,
}

impl Money {
    pub fn new(amount: Decimal, currency: Currency) -> Self {
        Self { amount, currency }
    }

    pub fn zero(currency: Currency) -> Self {
        Self {
            amount: Decimal::ZERO,
            currency,
        }
    }

    pub fn amount(&self) -> Decimal {
        self.amount
    }

    pub fn currency(&self) -> &Currency {
        &self.currency
    }

    /// Calculates the value in the system's reference base currency using the provided exchange rate.
    /// 1 base currency = `fx_rate` units of secondary currency.
    /// If this currency IS the base currency, the rate is ignored (treated as 1).
    pub fn to_base(&self, fx_rate: Decimal) -> Decimal {
        if self.currency.is_base || fx_rate.is_zero() {
            self.amount
        } else {
            self.amount / fx_rate
        }
    }

    pub fn is_positive(&self) -> bool {
        self.amount > Decimal::ZERO
    }

    pub fn is_zero(&self) -> bool {
        self.amount == Decimal::ZERO
    }

    pub fn is_negative(&self) -> bool {
        self.amount < Decimal::ZERO
    }
}

impl Add for Money {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        if self.currency.code != other.currency.code {
            panic!("Cannot add different currencies directly. Convert to same currency first.");
        }
        Self {
            amount: self.amount + other.amount,
            currency: self.currency,
        }
    }
}

impl Sub for Money {
    type Output = Self;

    fn sub(self, other: Self) -> Self {
        if self.currency.code != other.currency.code {
            panic!("Cannot subtract different currencies directly. Convert to same currency first.");
        }
        Self {
            amount: self.amount - other.amount,
            currency: self.currency,
        }
    }
}

impl Mul<Decimal> for Money {
    type Output = Self;

    fn mul(self, rhs: Decimal) -> Self {
        Self {
            amount: self.amount * rhs,
            currency: self.currency,
        }
    }
}
