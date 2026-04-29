#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct JournalEntryRow {
    pub id: String,
    pub entry_number: String,
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
    pub currency: String,
    pub fx_rate: String,
    pub debit: String,
    pub credit: String,
    pub description: String,
}
