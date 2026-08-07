use domain::accounting::OpeningBalanceMigration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone)]
pub struct OpeningLineInput {
    pub account_id: String,
    pub amount: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CreateOpeningBalanceMigrationCommand {
    pub cutover_date: String,
    pub notes: Option<String>,
    pub lines: Vec<OpeningLineInput>,
}

#[derive(Debug, Serialize)]
pub struct OpeningMigrationDto(pub OpeningBalanceMigration);