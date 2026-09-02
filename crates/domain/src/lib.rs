#![allow(clippy::invisible_characters)]
pub mod accounting;
pub mod assets;
pub mod audit;
pub mod auth;
pub mod customers;
pub mod inventory;
pub mod payments;
pub mod purchases;
pub mod returns;
pub mod sales;
pub mod settings;
pub mod shared;
pub mod suppliers;

#[cfg(test)]
mod tests;
