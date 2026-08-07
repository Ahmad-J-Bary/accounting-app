use crate::shared::errors::DomainError;
use crate::shared::ids::AccountId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum MigrationStatus {
    Draft,
    Posted,
    Cancelled,
}

impl MigrationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "Draft",
            Self::Posted => "Posted",
            Self::Cancelled => "Cancelled",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "Posted" => Self::Posted,
            "Cancelled" => Self::Cancelled,
            _ => Self::Draft,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningBalanceLine {
    pub account_id: AccountId,
    /// Positive magnitude of the opening balance. The Dr/Cr side is derived
    /// from the account's nature (assets/expenses = debit; liabilities/
    /// equity/revenue = credit) at posting time.
    pub amount: Decimal,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningBalanceMigration {
    pub id: String,
    pub cutover_date: DateTime<Utc>,
    pub status: MigrationStatus,
    pub notes: Option<String>,
    pub lines: Vec<OpeningBalanceLine>,
    pub posted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl OpeningBalanceMigration {
    pub fn new(
        id: String,
        cutover_date: DateTime<Utc>,
        notes: Option<String>,
        lines: Vec<OpeningBalanceLine>,
    ) -> Result<Self, DomainError> {
        if lines.is_empty() {
            return Err(DomainError::Invalid(
                "يجب إدخال بند واحد على الأقل في رصيد الافتتاح".into(),
            ));
        }
        for line in &lines {
            if line.amount <= Decimal::ZERO {
                return Err(DomainError::Invalid(
                    "قيم أرصدة الافتتاح يجب أن تكون أكبر من الصفر".into(),
                ));
            }
        }
        let now = Utc::now();
        Ok(Self {
            id,
            cutover_date,
            status: MigrationStatus::Draft,
            notes,
            lines,
            posted_at: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn set_notes(&mut self, notes: Option<String>) {
        self.notes = notes;
        self.updated_at = Utc::now();
    }

    pub fn mark_posted(&mut self) -> Result<(), DomainError> {
        if self.status != MigrationStatus::Draft {
            return Err(DomainError::Forbidden(
                "لا يمكن ترحيل الترحيل الذي ليس بحالة مسودة".into(),
            ));
        }
        self.status = MigrationStatus::Posted;
        self.posted_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<(), DomainError> {
        if self.status != MigrationStatus::Draft {
            return Err(DomainError::Forbidden(
                "لا يمكن إلغاء الترحيل بعد ترحيله".into(),
            ));
        }
        self.status = MigrationStatus::Cancelled;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn total_lines_amount(&self) -> Decimal {
        self.lines.iter().map(|l| l.amount).sum()
    }
}
