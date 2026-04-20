use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct InvoiceId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AccountId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CustomerId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ProductId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct JournalEntryId(pub Uuid);

impl InvoiceId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl AccountId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl CustomerId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl ProductId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl JournalEntryId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}
