use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::ops::{Add, Mul, Sub};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Money {
    amount: Decimal,
}

impl Money {
    pub fn new(amount: Decimal) -> Self {
        Self { amount }
    }

    pub fn zero() -> Self {
        Self {
            amount: Decimal::ZERO,
        }
    }

    pub fn amount(&self) -> Decimal {
        self.amount
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
        Self {
            amount: self.amount + other.amount,
        }
    }
}

impl Sub for Money {
    type Output = Self;

    fn sub(self, other: Self) -> Self {
        Self {
            amount: self.amount - other.amount,
        }
    }
}

impl Mul<Decimal> for Money {
    type Output = Self;

    fn mul(self, rhs: Decimal) -> Self {
        Self {
            amount: self.amount * rhs,
        }
    }
}

impl From<Decimal> for Money {
    fn from(amount: Decimal) -> Self {
        Self::new(amount)
    }
}
