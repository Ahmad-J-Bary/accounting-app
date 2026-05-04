use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLineDto {
    pub account_id: String,
    pub currency: String,
    pub fx_rate: String,
    pub debit: String,
    pub credit: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntryDto {
    pub id: String,
    pub entry_number: String,
    pub lines: Vec<JournalLineDto>,
    pub entry_date: String,
    pub description: String,
    pub status: String,
    pub total_base_debit: String,
    pub total_base_credit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJournalEntryRequest {
    pub entry_number: String,
    pub lines: Vec<JournalLineDto>,
    pub entry_date: String,
    pub description: String,
}

impl From<JournalEntry> for JournalEntryDto {
    fn from(entry: JournalEntry) -> Self {
        let total_base_debit = entry.total_base_debit().to_string();
        let total_base_credit = entry.total_base_credit().to_string();
        let status = format!("{:?}", entry.status);
        Self {
            id: entry.id.0.to_string(),
            entry_number: entry.entry_number,
            lines: entry.lines.into_iter().map(JournalLineDto::from).collect(),
            entry_date: entry.entry_date.to_rfc3339(),
            description: entry.description,
            status,
            total_base_debit,
            total_base_credit,
        }
    }
}

impl From<JournalLine> for JournalLineDto {
    fn from(line: JournalLine) -> Self {
        Self {
            account_id: line.account_id.0.to_string(),
            currency: line.debit.currency().code.clone(),
            fx_rate: line.debit.fx_rate.to_string(),
            debit: line.debit.amount().to_string(),
            credit: line.credit.amount().to_string(),
            description: line.description,
        }
    }
}
