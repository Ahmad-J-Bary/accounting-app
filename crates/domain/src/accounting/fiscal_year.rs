use crate::shared::errors::DomainError;
use crate::shared::ids::{FiscalPeriodId, FiscalYearId, JournalEntryId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FiscalYearStatus {
    Open,
    Closing,
    Closed,
    Reopened,
    Locked,
}

impl FiscalYearStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Open => "Open",
            Self::Closing => "Closing",
            Self::Closed => "Closed",
            Self::Reopened => "Reopened",
            Self::Locked => "Locked",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(value: &str) -> Self {
        match value {
            "Closing" => Self::Closing,
            "Closed" => Self::Closed,
            "Reopened" => Self::Reopened,
            "Locked" => Self::Locked,
            _ => Self::Open,
        }
    }

    pub fn can_post(self) -> bool {
        matches!(self, Self::Open | Self::Reopened)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FiscalYearCloseRunStatus {
    Started,
    Completed,
    Failed,
}

impl FiscalYearCloseRunStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Started => "Started",
            Self::Completed => "Completed",
            Self::Failed => "Failed",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(value: &str) -> Self {
        match value {
            "Completed" => Self::Completed,
            "Failed" => Self::Failed,
            _ => Self::Started,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalYear {
    pub id: FiscalYearId,
    pub company_id: Option<String>,
    pub label: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub status: FiscalYearStatus,
    pub previous_fiscal_year_id: Option<FiscalYearId>,
    pub closing_period_id: Option<FiscalPeriodId>,
    pub retained_earnings_entry_id: Option<JournalEntryId>,
    pub carry_forward_entry_id: Option<JournalEntryId>,
    pub last_close_operation_key: Option<String>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_by: Option<String>,
    pub locked_at: Option<DateTime<Utc>>,
    pub locked_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl FiscalYear {
    pub fn new(
        company_id: Option<String>,
        label: String,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
        previous_fiscal_year_id: Option<FiscalYearId>,
    ) -> Result<Self, DomainError> {
        if label.trim().is_empty() {
            return Err(DomainError::Invalid(
                "اسم/وسم السنة المالية لا يمكن أن يكون فارغًا".into(),
            ));
        }
        if start_date >= end_date {
            return Err(DomainError::Invalid(
                "تاريخ بداية السنة المالية يجب أن يسبق تاريخ النهاية".into(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: FiscalYearId::new(),
            company_id,
            label,
            start_date,
            end_date,
            status: FiscalYearStatus::Open,
            previous_fiscal_year_id,
            closing_period_id: None,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            last_close_operation_key: None,
            closed_at: None,
            closed_by: None,
            locked_at: None,
            locked_by: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn contains(&self, date: DateTime<Utc>) -> bool {
        date >= self.start_date && date <= self.end_date
    }

    pub fn start_closing(&mut self, by: &str, operation_key: &str) -> Result<(), DomainError> {
        if by.trim().is_empty() {
            return Err(DomainError::Invalid("منفذ الإقفال مطلوب".into()));
        }
        if operation_key.trim().is_empty() {
            return Err(DomainError::Invalid("مفتاح idempotency مطلوب".into()));
        }

        match self.status {
            FiscalYearStatus::Open | FiscalYearStatus::Reopened | FiscalYearStatus::Closing => {}
            FiscalYearStatus::Closed | FiscalYearStatus::Locked => {
                if self.last_close_operation_key.as_deref() == Some(operation_key) {
                    return Ok(());
                }
                return Err(DomainError::Invalid(
                    "السنة المالية مغلقة/مقفلة بالفعل".into(),
                ));
            }
        }

        let now = Utc::now();
        self.status = FiscalYearStatus::Closing;
        self.closed_by = Some(by.to_string());
        self.last_close_operation_key = Some(operation_key.to_string());
        self.updated_at = now;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn finalize_close(
        &mut self,
        by: &str,
        operation_key: &str,
        closing_period_id: FiscalPeriodId,
        retained_earnings_entry_id: Option<JournalEntryId>,
        carry_forward_entry_id: Option<JournalEntryId>,
    ) -> Result<(), DomainError> {
        self.start_closing(by, operation_key)?;

        let now = Utc::now();
        self.status = FiscalYearStatus::Closed;
        self.closing_period_id = Some(closing_period_id);
        self.retained_earnings_entry_id = retained_earnings_entry_id;
        self.carry_forward_entry_id = carry_forward_entry_id;
        self.closed_at = Some(now);
        self.closed_by = Some(by.to_string());
        self.last_close_operation_key = Some(operation_key.to_string());
        self.updated_at = now;
        Ok(())
    }

    pub fn reopen(&mut self) -> Result<(), DomainError> {
        if self.status != FiscalYearStatus::Closed {
            return Err(DomainError::Invalid(
                "لا يمكن إعادة فتح سنة مالية غير مغلقة".into(),
            ));
        }

        let now = Utc::now();
        self.status = FiscalYearStatus::Reopened;
        self.updated_at = now;
        Ok(())
    }

    pub fn lock(&mut self, by: &str) -> Result<(), DomainError> {
        if by.trim().is_empty() {
            return Err(DomainError::Invalid("منفذ القفل مطلوب".into()));
        }
        if self.status == FiscalYearStatus::Locked {
            return Err(DomainError::Invalid("السنة المالية مقفلة بالفعل".into()));
        }

        let now = Utc::now();
        self.status = FiscalYearStatus::Locked;
        self.locked_at = Some(now);
        self.locked_by = Some(by.to_string());
        self.updated_at = now;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalYearCloseRun {
    pub fiscal_year_id: FiscalYearId,
    pub operation_key: String,
    pub actor_id: String,
    pub status: FiscalYearCloseRunStatus,
    pub closing_period_id: Option<FiscalPeriodId>,
    pub retained_earnings_entry_id: Option<JournalEntryId>,
    pub carry_forward_entry_id: Option<JournalEntryId>,
    pub error_message: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

impl FiscalYearCloseRun {
    pub fn start(
        fiscal_year_id: FiscalYearId,
        operation_key: String,
        actor_id: String,
    ) -> Result<Self, DomainError> {
        if operation_key.trim().is_empty() {
            return Err(DomainError::Invalid("مفتاح idempotency مطلوب".into()));
        }
        if actor_id.trim().is_empty() {
            return Err(DomainError::Invalid("منفذ الإقفال مطلوب".into()));
        }

        let now = Utc::now();
        Ok(Self {
            fiscal_year_id,
            operation_key,
            actor_id,
            status: FiscalYearCloseRunStatus::Started,
            closing_period_id: None,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            error_message: None,
            started_at: now,
            completed_at: None,
            updated_at: now,
        })
    }

    pub fn complete(
        &mut self,
        closing_period_id: FiscalPeriodId,
        retained_earnings_entry_id: Option<JournalEntryId>,
        carry_forward_entry_id: Option<JournalEntryId>,
    ) {
        let now = Utc::now();
        self.status = FiscalYearCloseRunStatus::Completed;
        self.closing_period_id = Some(closing_period_id);
        self.retained_earnings_entry_id = retained_earnings_entry_id;
        self.carry_forward_entry_id = carry_forward_entry_id;
        self.completed_at = Some(now);
        self.error_message = None;
        self.updated_at = now;
    }

    pub fn fail(&mut self, message: String) {
        let now = Utc::now();
        self.status = FiscalYearCloseRunStatus::Failed;
        self.error_message = Some(message);
        self.updated_at = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn year() -> FiscalYear {
        let now = Utc::now();
        FiscalYear::new(
            None,
            "FY2026".into(),
            now - Duration::days(180),
            now + Duration::days(180),
            None,
        )
        .unwrap()
    }

    #[test]
    fn year_requires_valid_window_and_label() {
        let now = Utc::now();
        assert!(FiscalYear::new(None, "".into(), now, now + Duration::days(1), None).is_err());
        assert!(FiscalYear::new(None, "FY".into(), now, now, None).is_err());
    }

    #[test]
    fn close_is_idempotent_for_same_operation_key() {
        let mut fiscal_year = year();
        let period_id = FiscalPeriodId::new();
        fiscal_year
            .finalize_close("admin", "close-1", period_id, None, None)
            .unwrap();
        fiscal_year
            .finalize_close("admin", "close-1", period_id, None, None)
            .unwrap();
        assert_eq!(fiscal_year.status, FiscalYearStatus::Closed);
        assert_eq!(fiscal_year.last_close_operation_key.as_deref(), Some("close-1"));
    }

    #[test]
    fn close_with_different_operation_key_is_rejected_after_close() {
        let mut fiscal_year = year();
        let period_id = FiscalPeriodId::new();
        fiscal_year
            .finalize_close("admin", "close-1", period_id, None, None)
            .unwrap();
        assert!(fiscal_year
            .finalize_close("admin", "close-2", period_id, None, None)
            .is_err());
    }

    #[test]
    fn close_run_tracks_completion() {
        let year_id = FiscalYearId::new();
        let period_id = FiscalPeriodId::new();
        let mut run = FiscalYearCloseRun::start(year_id, "op-1".into(), "admin".into()).unwrap();
        run.complete(period_id, None, None);
        assert_eq!(run.status, FiscalYearCloseRunStatus::Completed);
        assert_eq!(run.closing_period_id, Some(period_id));
        assert!(run.completed_at.is_some());
    }
}
