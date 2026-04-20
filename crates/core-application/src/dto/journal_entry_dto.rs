use core_domain::accounting::journal_entry::{JournalEntry, JournalLine};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLineDto {
    pub account_id: String,
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
    pub total_debit: String,
    pub total_credit: String,
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
        let total_debit = entry.total_debit().amount().to_string();
        let total_credit = entry.total_credit().amount().to_string();
        let status = format!("{:?}", entry.status);
        Self {
            id: entry.id.0.to_string(),
            entry_number: entry.entry_number,
            lines: entry.lines.into_iter().map(JournalLineDto::from).collect(),
            entry_date: entry.entry_date.to_rfc3339(),
            description: entry.description,
            status,
            total_debit,
            total_credit,
        }
    }
}

impl From<JournalLine> for JournalLineDto {
    fn from(line: JournalLine) -> Self {
        Self {
            account_id: line.account_id.0.to_string(),
            debit: line.debit.amount().to_string(),
            credit: line.credit.amount().to_string(),
            description: line.description,
        }
    }
}
