use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLineDto {
    pub account_id: String,
    pub account_code: Option<String>,
    pub account_name: Option<String>,
    pub partner_id: Option<String>,
    pub partner_name: Option<String>,
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
    pub journal_type: JournalType,
    pub journal_type_display: String,
    pub source_id: Option<String>,
    pub lines: Vec<JournalLineDto>,
    pub entry_date: String,
    pub description: String,
    pub status: String,
    pub total_base_debit: String,
    pub total_base_credit: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJournalEntryRequest {
    pub entry_number: String,
    pub journal_type: JournalType,
    pub source_id: Option<String>,
    pub lines: Vec<JournalLineDto>,
    pub entry_date: String,
    pub description: String,
}

impl From<JournalEntry> for JournalEntryDto {
    fn from(entry: JournalEntry) -> Self {
        let total_base_debit = entry.total_base_debit().to_string();
        let total_base_credit = entry.total_base_credit().to_string();
        let status = format!("{:?}", entry.status);
        let journal_type_display = entry.journal_type.to_string();
        Self {
            id: entry.id.0.to_string(),
            entry_number: entry.entry_number,
            journal_type: entry.journal_type,
            journal_type_display,
            source_id: entry.source_id,
            lines: entry.lines.into_iter().map(JournalLineDto::from).collect(),
            entry_date: entry.entry_date.to_rfc3339(),
            description: entry.description,
            status,
            total_base_debit,
            total_base_credit,
            created_at: entry.created_at.to_rfc3339(),
            updated_at: entry.updated_at.to_rfc3339(),
        }
    }
}

impl From<JournalLine> for JournalLineDto {
    fn from(line: JournalLine) -> Self {
        Self {
            account_id: line.account_id.0.to_string(),
            account_code: None,
            account_name: None,
            partner_id: line.partner_id.map(|id| id.to_string()),
            partner_name: None,
            currency: line.debit.currency().code.clone(),
            fx_rate: line.debit.fx_rate.to_string(),
            debit: line.debit.amount().to_string(),
            credit: line.credit.amount().to_string(),
            description: line.description,
        }
    }
}
