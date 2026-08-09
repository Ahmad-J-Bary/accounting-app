use crate::shared::errors::DomainError;
use crate::shared::ids::FiscalPeriodId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Lifecycle of a fiscal period (Sec 20). A `Closed` period must not host new
/// posting; `Reopened` returns it to `Open` so corrections can be recorded,
/// but closed financial history stays immutable through reversals only.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FiscalPeriodStatus {
    Open,
    Closing,
    Closed,
    Reopened,
    Cancelled,
}

impl FiscalPeriodStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Open => "Open",
            Self::Closing => "Closing",
            Self::Closed => "Closed",
            Self::Reopened => "Reopened",
            Self::Cancelled => "Cancelled",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "Closing" => Self::Closing,
            "Closed" => Self::Closed,
            "Reopened" => Self::Reopened,
            "Cancelled" => Self::Cancelled,
            _ => Self::Open,
        }
    }
}

/// A formal fiscal period the current-period net profit belongs to (Sec 19 /
/// Sec 20). Independent from the opening-balance cutover: the cutover is the
/// company's position at a moment in time; the period is the reporting window.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalPeriod {
    pub id: FiscalPeriodId,
    /// Single-company deployment: `None` until a companies table exists.
    pub company_id: Option<String>,
    /// Inclusive period start (accounting/effective dates only).
    pub start_date: DateTime<Utc>,
    /// Inclusive period end (accounting/effective dates only).
    pub end_date: DateTime<Utc>,
    pub status: FiscalPeriodStatus,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl FiscalPeriod {
    pub fn new(
        company_id: Option<String>,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> Result<Self, DomainError> {
        if start_date >= end_date {
            return Err(DomainError::Invalid(
                "تاريخ بداية الفترة المالية يجب أن يسبق تاريخ النهاية".into(),
            ));
        }
        let now = Utc::now();
        Ok(Self {
            id: FiscalPeriodId::new(),
            company_id,
            start_date,
            end_date,
            status: FiscalPeriodStatus::Open,
            closed_at: None,
            closed_by: None,
            created_at: now,
            updated_at: now,
        })
    }

    /// Moves the period to `Closed`, recording who/how. The period must not
    /// already be closed or cancelled; a `Closing` period may be finalized.
    pub fn close(&mut self, by: &str, status: FiscalPeriodStatus) -> Result<(), DomainError> {
        if !matches!(self.status, FiscalPeriodStatus::Open | FiscalPeriodStatus::Closing | FiscalPeriodStatus::Reopened) {
            return Err(DomainError::Invalid(
                "لا يمكن إغلاق فترة سبق إغلاقها أو إلغاؤها".into(),
            ));
        }
        if status != FiscalPeriodStatus::Closing && status != FiscalPeriodStatus::Closed {
            return Err(DomainError::Invalid(
                "حالة إغلاق غير صالحة للفترة المالية".into(),
            ));
        }
        let now = Utc::now();
        self.status = status;
        self.closed_at = Some(now);
        self.closed_by = Some(by.to_string());
        self.updated_at = now;
        Ok(())
    }

    /// Reopens a previously closed period (explicit accountant action). The
    /// period must be `Closed` to be reopened.
    pub fn reopen(&mut self) -> Result<(), DomainError> {
        if self.status != FiscalPeriodStatus::Closed {
            return Err(DomainError::Invalid(
                "لا يمكن فتح فترة مالية غير مغلقة".into(),
            ));
        }
        let now = Utc::now();
        self.status = FiscalPeriodStatus::Reopened;
        self.closed_at = None;
        self.closed_by = None;
        self.updated_at = now;
        Ok(())
    }

    /// The period can accept new accounting for dates within its window only.
    pub fn contains(&self, date: DateTime<Utc>) -> bool {
        date >= self.start_date && date <= self.end_date
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn period() -> FiscalPeriod {
        let now = Utc::now();
        FiscalPeriod::new(None, now - Duration::days(30), now + Duration::days(30)).unwrap()
    }

    #[test]
    fn start_must_predate_end() {
        let now = Utc::now();
        assert!(FiscalPeriod::new(None, now, now - Duration::days(1)).is_err());
        assert!(FiscalPeriod::new(None, now, now).is_err());
    }

    #[test]
    fn close_sets_status_and_meta() {
        let mut p = period();
        p.close("user1", FiscalPeriodStatus::Closed).unwrap();
        assert_eq!(p.status, FiscalPeriodStatus::Closed);
        assert!(p.closed_at.is_some());
        assert_eq!(p.closed_by.as_deref(), Some("user1"));
    }

    #[test]
    fn closing_then_closed_is_valid() {
        let mut p = period();
        p.close("u", FiscalPeriodStatus::Closing).unwrap();
        assert_eq!(p.status, FiscalPeriodStatus::Closing);
        p.close("u", FiscalPeriodStatus::Closed).unwrap();
        assert_eq!(p.status, FiscalPeriodStatus::Closed);
    }

    #[test]
    fn double_close_rejected() {
        let mut p = period();
        p.close("u", FiscalPeriodStatus::Closed).unwrap();
        assert!(p.close("u", FiscalPeriodStatus::Closed).is_err());
    }

    #[test]
    fn cancelled_cannot_close() {
        let mut p = period();
        p.status = FiscalPeriodStatus::Cancelled;
        assert!(p.close("u", FiscalPeriodStatus::Closed).is_err());
    }

    #[test]
    fn reopen_only_from_closed() {
        let mut p = period();
        // Can't reopen an open period.
        assert!(p.reopen().is_err());
        p.close("u", FiscalPeriodStatus::Closed).unwrap();
        p.reopen().unwrap();
        assert_eq!(p.status, FiscalPeriodStatus::Reopened);
        assert!(p.closed_at.is_none());
    }

    #[test]
    fn contains_respects_bounds() {
        let p = period();
        assert!(!p.contains(p.start_date - Duration::days(1)));
        assert!(p.contains(p.start_date));
        assert!(p.contains(p.end_date));
        assert!(!p.contains(p.end_date + Duration::days(1)));
    }
}