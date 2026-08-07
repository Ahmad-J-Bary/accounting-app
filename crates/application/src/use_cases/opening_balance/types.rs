use domain::accounting::OpeningBalanceMigration;
use rust_decimal::Decimal;
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

#[derive(Debug, Serialize)]
pub struct PostOpeningBalanceResult {
    pub migration: OpeningMigrationDto,
    pub debit_total: Decimal,
    pub credit_total: Decimal,
    pub equity_balanced: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AllocateNetProfitCommand {
    pub migration_id: String,
    pub net_profit: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PartnerAllocationShare {
    pub partner_id: String,
    pub partner_name: String,
    pub capital: Decimal,
    pub ratio_percent: Decimal,
    pub share: Decimal,
}

#[derive(Debug, Serialize)]
pub struct NetProfitAllocationDto {
    pub entry_number: String,
    pub net_profit: Decimal,
    pub allocated_total: Decimal,
    pub shares: Vec<PartnerAllocationShare>,
}