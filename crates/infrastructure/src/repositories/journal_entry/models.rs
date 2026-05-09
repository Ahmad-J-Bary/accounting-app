#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct JournalEntryRow {
    pub id: String,
    pub entry_number: String,
    pub journal_type: String,
    pub source_id: Option<String>,
    pub entry_date: String,
    pub description: String,
    pub status: String,
    pub created_at: String,
    pub posted_at: Option<String>,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct JournalLineRow {
    pub id: String,
    pub account_id: String,
    pub partner_id: Option<String>,
    pub currency: String,
    pub fx_rate: String,
    pub debit: String,
    pub debit_base: String,
    pub credit: String,
    pub credit_base: String,
    pub description: String,
}
