use std::sync::Arc;

use chrono::{DateTime, Utc};
use domain::accounting::fiscal_period::FiscalPeriod;
use domain::accounting::fiscal_year::FiscalYear;

use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PostingOperationType {
    NormalOperational,
    OpeningBalance,
    OpeningResidualReclassification,
    Reversal,
    Correction,
    FiscalYearClosing,
    CarryForward,
    OpeningNextFiscalYear,
    OtherSystemGenerated,
}

#[derive(Debug, Clone)]
pub struct PostingContext {
    pub company_id: Option<String>,
    pub transaction_date: DateTime<Utc>,
    pub operation_type: PostingOperationType,
}

#[derive(Debug, Clone)]
pub struct ResolvedFiscalLifecycle {
    pub fiscal_year: FiscalYear,
    pub fiscal_period: FiscalPeriod,
}

pub struct FiscalLifecyclePolicy {
    year_repo: Arc<dyn FiscalYearRepository>,
    period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl FiscalLifecyclePolicy {
    pub fn new(
        year_repo: Arc<dyn FiscalYearRepository>,
        period_repo: Arc<dyn FiscalPeriodRepository>,
    ) -> Self {
        Self {
            year_repo,
            period_repo,
        }
    }

    pub async fn validate(
        &self,
        context: PostingContext,
    ) -> Result<ResolvedFiscalLifecycle, AppError> {
        match context.operation_type {
            PostingOperationType::NormalOperational => {
                self.validate_normal_operational(context.company_id.as_deref(), context.transaction_date)
                    .await
            }
            _ => Err(AppError::Unsupported(
                "سياسات lifecycle للعمليات الخاصة لم تُعتمد بعد".into(),
            )),
        }
    }

    pub async fn validate_normal_operational(
        &self,
        company_id: Option<&str>,
        transaction_date: DateTime<Utc>,
    ) -> Result<ResolvedFiscalLifecycle, AppError> {
        let fiscal_year = self
            .resolve_fiscal_year(company_id, transaction_date)
            .await?;
        let fiscal_period = self
            .resolve_fiscal_period(company_id, transaction_date)
            .await?;

        if !fiscal_year.status.can_post() {
            return Err(AppError::FiscalYearClosed(format!(
                "تاريخ العملية {} يقع ضمن سنة مالية حالتها {}",
                transaction_date.to_rfc3339(),
                fiscal_year.status.as_str()
            )));
        }

        if !fiscal_period.status.can_post() {
            return Err(AppError::FiscalPeriodClosed(format!(
                "تاريخ العملية {} يقع ضمن فترة مالية حالتها {}",
                transaction_date.to_rfc3339(),
                fiscal_period.status.as_str()
            )));
        }

        if fiscal_period.start_date < fiscal_year.start_date || fiscal_period.end_date > fiscal_year.end_date {
            return Err(AppError::InvalidFiscalLifecycle(format!(
                "الفترة المالية {}..{} لا تقع بالكامل داخل السنة المالية {}..{}",
                fiscal_period.start_date.to_rfc3339(),
                fiscal_period.end_date.to_rfc3339(),
                fiscal_year.start_date.to_rfc3339(),
                fiscal_year.end_date.to_rfc3339(),
            )));
        }

        Ok(ResolvedFiscalLifecycle {
            fiscal_year,
            fiscal_period,
        })
    }

    pub async fn resolve_fiscal_year(
        &self,
        company_id: Option<&str>,
        transaction_date: DateTime<Utc>,
    ) -> Result<FiscalYear, AppError> {
        let matches = self.year_repo.find_by_date(transaction_date).await?;
        resolve_single_year(company_id, transaction_date, matches)
    }

    pub async fn resolve_fiscal_period(
        &self,
        company_id: Option<&str>,
        transaction_date: DateTime<Utc>,
    ) -> Result<FiscalPeriod, AppError> {
        let matches = self.period_repo.find_by_date(transaction_date).await?;
        resolve_single_period(company_id, transaction_date, matches)
    }
}

fn same_company(requested: Option<&str>, record: Option<&str>) -> bool {
    requested == record
}

fn resolve_single_year(
    company_id: Option<&str>,
    transaction_date: DateTime<Utc>,
    candidates: Vec<FiscalYear>,
) -> Result<FiscalYear, AppError> {
    let scoped: Vec<FiscalYear> = candidates
        .into_iter()
        .filter(|year| same_company(company_id, year.company_id.as_deref()))
        .collect();

    match scoped.len() {
        0 => Err(AppError::MissingFiscalYear(format!(
            "لا توجد سنة مالية تغطي التاريخ {}",
            transaction_date.to_rfc3339()
        ))),
        1 => Ok(scoped.into_iter().next().expect("single year must exist")),
        _ => Err(AppError::AmbiguousFiscalLifecycle(format!(
            "يوجد أكثر من سنة مالية تغطي التاريخ {}",
            transaction_date.to_rfc3339()
        ))),
    }
}

fn resolve_single_period(
    company_id: Option<&str>,
    transaction_date: DateTime<Utc>,
    candidates: Vec<FiscalPeriod>,
) -> Result<FiscalPeriod, AppError> {
    let scoped: Vec<FiscalPeriod> = candidates
        .into_iter()
        .filter(|period| same_company(company_id, period.company_id.as_deref()))
        .collect();

    match scoped.len() {
        0 => Err(AppError::MissingFiscalPeriod(format!(
            "لا توجد فترة مالية تغطي التاريخ {}",
            transaction_date.to_rfc3339()
        ))),
        1 => Ok(scoped.into_iter().next().expect("single period must exist")),
        _ => Err(AppError::AmbiguousFiscalLifecycle(format!(
            "يوجد أكثر من فترة مالية تغطي التاريخ {}",
            transaction_date.to_rfc3339()
        ))),
    }
}

pub fn windows_overlap(
    left_start: DateTime<Utc>,
    left_end: DateTime<Utc>,
    right_start: DateTime<Utc>,
    right_end: DateTime<Utc>,
) -> bool {
    left_start <= right_end && right_start <= left_end
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockFiscalPeriodRepository, MockFiscalYearRepository};
    use chrono::Duration;
    use domain::accounting::{FiscalPeriodStatus, FiscalYearStatus};

    fn make_year(start: DateTime<Utc>, end: DateTime<Utc>) -> FiscalYear {
        FiscalYear::new(None, "FY".into(), start, end, None).unwrap()
    }

    fn make_period(start: DateTime<Utc>, end: DateTime<Utc>, status: FiscalPeriodStatus) -> FiscalPeriod {
        let mut period = FiscalPeriod::new(None, start, end).unwrap();
        period.status = status;
        period
    }

    #[tokio::test]
    async fn normal_posting_inside_open_windows_is_allowed() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        year_repo.create(&make_year(start, end)).await.unwrap();
        period_repo
            .create(&make_period(start, end, FiscalPeriodStatus::Open))
            .await
            .unwrap();

        let service = FiscalLifecyclePolicy::new(year_repo, period_repo);
        let result = service
            .validate_normal_operational(None, start + Duration::days(1))
            .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn posting_outside_year_is_rejected() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() - Duration::days(1);
        year_repo.create(&make_year(start, end)).await.unwrap();
        period_repo
            .create(&make_period(start, end, FiscalPeriodStatus::Open))
            .await
            .unwrap();

        let service = FiscalLifecyclePolicy::new(year_repo, period_repo);
        let err = service
            .validate_normal_operational(None, Utc::now())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::MissingFiscalYear(_)));
    }

    #[tokio::test]
    async fn posting_outside_period_is_rejected() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let year_start = Utc::now() - Duration::days(30);
        let year_end = Utc::now() + Duration::days(30);
        year_repo.create(&make_year(year_start, year_end)).await.unwrap();
        period_repo
            .create(&make_period(
                year_start,
                Utc::now() - Duration::days(1),
                FiscalPeriodStatus::Open,
            ))
            .await
            .unwrap();

        let service = FiscalLifecyclePolicy::new(year_repo, period_repo);
        let err = service
            .validate_normal_operational(None, Utc::now())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::MissingFiscalPeriod(_)));
    }

    #[tokio::test]
    async fn closed_period_is_rejected() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        year_repo.create(&make_year(start, end)).await.unwrap();
        period_repo
            .create(&make_period(start, end, FiscalPeriodStatus::Closed))
            .await
            .unwrap();

        let service = FiscalLifecyclePolicy::new(year_repo, period_repo);
        let err = service
            .validate_normal_operational(None, Utc::now())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::FiscalPeriodClosed(_)));
    }

    #[tokio::test]
    async fn locked_year_is_rejected() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        let mut year = make_year(start, end);
        year.status = FiscalYearStatus::Locked;
        year_repo.create(&year).await.unwrap();
        period_repo
            .create(&make_period(start, end, FiscalPeriodStatus::Open))
            .await
            .unwrap();

        let service = FiscalLifecyclePolicy::new(year_repo, period_repo);
        let err = service
            .validate_normal_operational(None, Utc::now())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::FiscalYearClosed(_)));
    }

    #[tokio::test]
    async fn overlapping_periods_are_rejected_as_ambiguous() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let start = Utc::now() - Duration::days(30);
        let end = Utc::now() + Duration::days(30);
        year_repo.create(&make_year(start, end)).await.unwrap();
        period_repo
            .create(&make_period(start, end, FiscalPeriodStatus::Open))
            .await
            .unwrap();
        period_repo
            .create(&make_period(
                Utc::now() - Duration::days(5),
                Utc::now() + Duration::days(5),
                FiscalPeriodStatus::Open,
            ))
            .await
            .unwrap();

        let service = FiscalLifecyclePolicy::new(year_repo, period_repo);
        let err = service
            .resolve_fiscal_period(None, Utc::now())
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::AmbiguousFiscalLifecycle(_)));
    }

    #[test]
    fn overlap_helper_respects_boundaries() {
        let now = Utc::now();
        assert!(windows_overlap(
            now,
            now + Duration::days(10),
            now + Duration::days(10),
            now + Duration::days(20)
        ));
        assert!(!windows_overlap(
            now,
            now + Duration::days(9),
            now + Duration::days(10),
            now + Duration::days(20)
        ));
    }
}
