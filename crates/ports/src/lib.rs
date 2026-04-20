// Ports and interfaces for the application
// This crate defines the interfaces that the application layer depends on

pub mod repository;

use async_trait::async_trait;

// Re-export common traits
pub use repository::*;
