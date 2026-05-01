use serde::{Deserialize, Serialize};
use uuid::Uuid;

macro_rules! define_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
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

define_id!(CustomerId);
define_id!(SupplierId);
define_id!(PartnerId);
define_id!(InvoiceId);
define_id!(AccountId);
define_id!(MaterialId);
define_id!(MaterialCategoryId);
define_id!(MaterialUnitId);
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
