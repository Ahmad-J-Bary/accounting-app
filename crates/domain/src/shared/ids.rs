use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::sync::atomic::{AtomicU64, Ordering};

macro_rules! define_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
        pub struct $name(pub Uuid);

        impl $name {
            pub fn new() -> Self {
                Self(Uuid::new_v4())
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl std::str::FromStr for $name {
            type Err = uuid::Error;
            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Ok(Self(Uuid::parse_str(s)?))
            }
        }
    };
}

// Sequential numeric ID for customers (starts from 2)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CustomerId(pub u64);

static CUSTOMER_ID_COUNTER: AtomicU64 = AtomicU64::new(2);

impl CustomerId {
    pub fn new() -> Self {
        Self(CUSTOMER_ID_COUNTER.fetch_add(1, Ordering::SeqCst))
    }

    pub fn from_u64(id: u64) -> Self {
        Self(id)
    }
}

impl Default for CustomerId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for CustomerId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for CustomerId {
    type Err = std::num::ParseIntError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(s.parse()?))
    }
}

// Sequential numeric ID for suppliers (starts from 2)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SupplierId(pub u64);

static SUPPLIER_ID_COUNTER: AtomicU64 = AtomicU64::new(2);

impl SupplierId {
    pub fn new() -> Self {
        Self(SUPPLIER_ID_COUNTER.fetch_add(1, Ordering::SeqCst))
    }

    pub fn from_u64(id: u64) -> Self {
        Self(id)
    }
}

impl Default for SupplierId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for SupplierId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for SupplierId {
    type Err = std::num::ParseIntError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(s.parse()?))
    }
}

// Sequential numeric ID for partners (starts from 1)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PartnerId(pub u64);

static PARTNER_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

impl PartnerId {
    pub fn new() -> Self {
        Self(PARTNER_ID_COUNTER.fetch_add(1, Ordering::SeqCst))
    }

    pub fn from_u64(id: u64) -> Self {
        Self(id)
    }
}

impl Default for PartnerId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for PartnerId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::str::FromStr for PartnerId {
    type Err = std::num::ParseIntError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(s.parse()?))
    }
}

define_id!(InvoiceId);
define_id!(AccountId);
define_id!(MaterialId);
define_id!(MaterialCategoryId);
define_id!(JournalEntryId);
define_id!(SalesInvoiceId);
define_id!(PurchaseInvoiceId);
define_id!(PaymentId);
define_id!(StockMovementId);
define_id!(DamagedItemId);
define_id!(ProductionOrderId);
define_id!(StockAdjustmentId);
define_id!(UserId);
define_id!(RoleId);
define_id!(AuditLogId);

