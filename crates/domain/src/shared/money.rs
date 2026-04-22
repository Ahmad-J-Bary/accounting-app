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

    pub fn syp(amount: Decimal) -> Self {
        Self {
            amount,
            currency: Currency::SYP,
        }
    }

    pub fn usd(amount: Decimal) -> Self {
        Self {
            amount,
            currency: Currency::USD,
        }
    }

    pub fn zero() -> Self {
        Self {
            amount: Decimal::ZERO,
            currency: Currency::SYP,
        }
    }

    pub fn amount(&self) -> Decimal {
        self.amount
    }

    pub fn currency(&self) -> Currency {
        self.currency
    }

    /// يحسب القيمة بالليرة السورية بناءً على سعر صرف محدد
    pub fn to_base(&self, fx_rate: Decimal) -> Decimal {
        match self.currency {
            Currency::SYP => self.amount,
            Currency::USD => self.amount * fx_rate,
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
        if self.currency != other.currency {
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
        if self.currency != other.currency {
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
