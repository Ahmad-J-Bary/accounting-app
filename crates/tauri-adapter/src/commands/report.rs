use tauri::State;

use crate::bootstrap::container::AppState;
use application::dto::report_dto::{BalanceSheetDto, BalanceSheetLineDto, ProfitLossDto, ProfitLossLineDto, TrialBalanceDto, TrialBalanceLineDto};
use domain::accounting::account::{AccountType, NormalBalance};

/// Compute the normal balance side for an account type.
fn normal_balance(account_type: &AccountType) -> NormalBalance {
    match account_type {
        AccountType::Assets | AccountType::Expenses => NormalBalance::Debit,
        AccountType::Liabilities | AccountType::Equity | AccountType::Revenue => NormalBalance::Credit,
    }
}

/// Trial Balance: aggregated debit/credit per account across all posted,
/// non-reversed journal lines. Includes FiscalClosing entries so the
/// Trial Balance remains balanced after fiscal year close.
///
/// When `from_date` / `to_date` are provided (ISO-8601 date strings),
/// the response includes opening/period splits for the given window.
/// When omitted, opening and period fields default to the cumulative totals.
#[tauri::command]
pub async fn get_trial_balance(
    state: State<'_, AppState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<TrialBalanceDto, String> {
    let agg_rows = state
        .journal_entry_repo
        .aggregate_by_account()
        .await
        .map_err(|e| e.to_string())?;

    // When date filters are provided, also fetch period-specific aggregates
    // so we can split cumulative totals into opening + period.
    let period_agg = if let (Some(ref fd), Some(ref td)) = (&from_date, &to_date) {
        let from_dt = chrono::NaiveDate::parse_from_str(fd, "%Y-%m-%d")
            .map_err(|e| format!("Invalid from_date: {e}"))?
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| "Invalid from_date time".to_string())?;

        let to_dt = chrono::NaiveDate::parse_from_str(td, "%Y-%m-%d")
            .map_err(|e| format!("Invalid to_date: {e}"))?
            .and_hms_opt(23, 59, 59)
            .ok_or_else(|| "Invalid to_date time".to_string())?;

        let from_utc = from_dt.and_utc();
        let to_utc = to_dt.and_utc();

        Some(
            state
                .journal_entry_repo
                .aggregate_by_account_for_period(from_utc, to_utc)
                .await
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };

    let account_ids: Vec<_> = agg_rows.iter().map(|r| r.account_id).collect();
    let accounts = state
        .account_repo
        .find_by_ids(&account_ids)
        .await
        .map_err(|e| e.to_string())?;

    let account_map: std::collections::HashMap<_, _> =
        accounts.into_iter().map(|a| (a.id, a)).collect();

    // Build period lookup: account_id -> (debit, credit)
    let period_map: std::collections::HashMap<_, _> = period_agg
        .as_ref()
        .map(|rows| {
            rows.iter()
                .map(|r| (r.account_id, (r.total_debit_base, r.total_credit_base)))
                .collect()
        })
        .unwrap_or_default();

    let mut total_debit = rust_decimal::Decimal::ZERO;
    let mut total_credit = rust_decimal::Decimal::ZERO;
    let mut total_opening_debit = rust_decimal::Decimal::ZERO;
    let mut total_opening_credit = rust_decimal::Decimal::ZERO;
    let mut total_period_debit = rust_decimal::Decimal::ZERO;
    let mut total_period_credit = rust_decimal::Decimal::ZERO;

    let mut lines: Vec<TrialBalanceLineDto> = agg_rows
        .into_iter()
        .filter_map(|row| {
            let account = account_map.get(&row.account_id)?;
            let nb = normal_balance(&account.account_type);
            let net = row.total_debit_base - row.total_credit_base;

            let (debit_total, credit_total) = match nb {
                NormalBalance::Debit => {
                    if net > rust_decimal::Decimal::ZERO {
                        (net, rust_decimal::Decimal::ZERO)
                    } else {
                        (rust_decimal::Decimal::ZERO, -net)
                    }
                }
                NormalBalance::Credit => {
                    if net > rust_decimal::Decimal::ZERO {
                        (rust_decimal::Decimal::ZERO, net)
                    } else {
                        (-net, rust_decimal::Decimal::ZERO)
                    }
                }
            };

            // Compute opening/period split when period data is available
            let (opening_debit, opening_credit, period_debit, period_credit) =
                if let Some((p_debit, p_credit)) = period_map.get(&row.account_id) {
                    let p_net = *p_debit - *p_credit;
                    let o_net = net - p_net;

                    let (o_debit, o_credit) = match nb {
                        NormalBalance::Debit => {
                            if o_net > rust_decimal::Decimal::ZERO {
                                (o_net, rust_decimal::Decimal::ZERO)
                            } else {
                                (rust_decimal::Decimal::ZERO, -o_net)
                            }
                        }
                        NormalBalance::Credit => {
                            if o_net > rust_decimal::Decimal::ZERO {
                                (rust_decimal::Decimal::ZERO, o_net)
                            } else {
                                (-o_net, rust_decimal::Decimal::ZERO)
                            }
                        }
                    };

                    let (pd, pc) = match nb {
                        NormalBalance::Debit => {
                            if p_net > rust_decimal::Decimal::ZERO {
                                (p_net, rust_decimal::Decimal::ZERO)
                            } else {
                                (rust_decimal::Decimal::ZERO, -p_net)
                            }
                        }
                        NormalBalance::Credit => {
                            if p_net > rust_decimal::Decimal::ZERO {
                                (rust_decimal::Decimal::ZERO, p_net)
                            } else {
                                (-p_net, rust_decimal::Decimal::ZERO)
                            }
                        }
                    };

                    (o_debit, o_credit, pd, pc)
                } else {
                    // No period filter — opening = cumulative, period = 0
                    (debit_total, credit_total, rust_decimal::Decimal::ZERO, rust_decimal::Decimal::ZERO)
                };

            total_debit += debit_total;
            total_credit += credit_total;
            total_opening_debit += opening_debit;
            total_opening_credit += opening_credit;
            total_period_debit += period_debit;
            total_period_credit += period_credit;

            Some(TrialBalanceLineDto {
                account_id: account.id.0.to_string(),
                account_code: account.code.clone(),
                account_name: account.name_ar.clone(),
                account_type: format!("{:?}", account.account_type),
                debit_total: debit_total.to_string(),
                credit_total: credit_total.to_string(),
                balance: net.to_string(),
                opening_debit: opening_debit.to_string(),
                opening_credit: opening_credit.to_string(),
                period_debit: period_debit.to_string(),
                period_credit: period_credit.to_string(),
            })
        })
        .collect();

    // Sort by account code for deterministic output
    lines.sort_by(|a, b| a.account_code.cmp(&b.account_code));

    Ok(TrialBalanceDto {
        lines,
        total_debit: total_debit.to_string(),
        total_credit: total_credit.to_string(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        total_opening_debit: total_opening_debit.to_string(),
        total_opening_credit: total_opening_credit.to_string(),
        total_period_debit: total_period_debit.to_string(),
        total_period_credit: total_period_credit.to_string(),
    })
}

/// Income Statement (Profit & Loss): revenue and expense accounts aggregated
/// from the GL, net profit = total_revenue - total_expenses.
/// Excludes FiscalClosing entries so the IS shows operational activity only,
/// not the closing process itself.
///
/// When `from_date` / `to_date` are provided (ISO-8601 date strings),
/// the aggregation is bounded to that period.
/// When omitted, uses cumulative totals (all time).
#[tauri::command]
pub async fn get_income_statement(
    state: State<'_, AppState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<ProfitLossDto, String> {
    let agg_rows = if let (Some(ref fd), Some(ref td)) = (&from_date, &to_date) {
        let from_dt = chrono::NaiveDate::parse_from_str(fd, "%Y-%m-%d")
            .map_err(|e| format!("Invalid from_date: {e}"))?
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| "Invalid from_date time".to_string())?;

        let to_dt = chrono::NaiveDate::parse_from_str(td, "%Y-%m-%d")
            .map_err(|e| format!("Invalid to_date: {e}"))?
            .and_hms_opt(23, 59, 59)
            .ok_or_else(|| "Invalid to_date time".to_string())?;

        state
            .journal_entry_repo
            .aggregate_by_account_report_for_period(from_dt.and_utc(), to_dt.and_utc())
            .await
            .map_err(|e| e.to_string())?
    } else {
        state
            .journal_entry_repo
            .aggregate_by_account_report()
            .await
            .map_err(|e| e.to_string())?
    };

    let account_ids: Vec<_> = agg_rows.iter().map(|r| r.account_id).collect();
    let accounts = state
        .account_repo
        .find_by_ids(&account_ids)
        .await
        .map_err(|e| e.to_string())?;

    let account_map: std::collections::HashMap<_, _> =
        accounts.into_iter().map(|a| (a.id, a)).collect();

    let mut revenue_lines = Vec::new();
    let mut expense_lines = Vec::new();
    let mut total_revenue = rust_decimal::Decimal::ZERO;
    let mut total_expenses = rust_decimal::Decimal::ZERO;

    for row in agg_rows {
        let account = match account_map.get(&row.account_id) {
            Some(a) => a,
            None => continue,
        };

        let net = row.total_debit_base - row.total_credit_base;

            match account.account_type {
                AccountType::Revenue => {
                    // Revenue is credit-normal: positive credit = revenue
                    let amount = -net; // net = debit - credit; for revenue, credit > debit => negative net => positive amount
                    total_revenue += amount;
                    revenue_lines.push(ProfitLossLineDto {
                        account_name: account.name_ar.clone(),
                        amount: amount.to_string(),
                        account_code: account.code.clone(),
                        account_type: format!("{:?}", account.account_type),
                    });
                }
                AccountType::Expenses => {
                    // Expenses are debit-normal: positive debit = expense
                    let amount = net; // net = debit - credit; for expenses, debit > credit => positive net
                    total_expenses += amount;
                    expense_lines.push(ProfitLossLineDto {
                        account_name: account.name_ar.clone(),
                        amount: amount.to_string(),
                        account_code: account.code.clone(),
                        account_type: format!("{:?}", account.account_type),
                    });
                }
            _ => continue,
        }
    }

    revenue_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));
    expense_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));

    let net_profit = total_revenue - total_expenses;

    Ok(ProfitLossDto {
        revenue_lines,
        expense_lines,
        total_revenue: total_revenue.to_string(),
        total_expenses: total_expenses.to_string(),
        net_profit: net_profit.to_string(),
        period_start: from_date.unwrap_or_default(),
        period_end: to_date.unwrap_or_default(),
    })
}

/// Balance Sheet: assets, liabilities, and equity accounts aggregated from the
/// GL. Includes FiscalClosing so Retained Earnings reflects the closed year's
/// profit/loss. Revenue/Expense accounts are filtered by AccountType, not
/// journal_type.
///
/// Also computes `net_profit` (total Revenue - total Expenses) and
/// `total_drawings` (net of the DRAWINGS system account) so the frontend
/// can display the full equity equation without re-reading raw journals.
#[tauri::command]
pub async fn get_balance_sheet(state: State<'_, AppState>) -> Result<BalanceSheetDto, String> {
    let agg_rows = state
        .journal_entry_repo
        .aggregate_by_account()
        .await
        .map_err(|e| e.to_string())?;

    let account_ids: Vec<_> = agg_rows.iter().map(|r| r.account_id).collect();
    let accounts = state
        .account_repo
        .find_by_ids(&account_ids)
        .await
        .map_err(|e| e.to_string())?;

    let account_map: std::collections::HashMap<_, _> =
        accounts.into_iter().map(|a| (a.id, a)).collect();

    let mut asset_lines = Vec::new();
    let mut liability_lines = Vec::new();
    let mut equity_lines = Vec::new();
    let mut total_assets = rust_decimal::Decimal::ZERO;
    let mut total_liabilities = rust_decimal::Decimal::ZERO;
    let mut total_equity = rust_decimal::Decimal::ZERO;
    let mut total_revenue = rust_decimal::Decimal::ZERO;
    let mut total_expenses = rust_decimal::Decimal::ZERO;
    let mut total_drawings = rust_decimal::Decimal::ZERO;

    for row in agg_rows {
        let account = match account_map.get(&row.account_id) {
            Some(a) => a,
            None => continue,
        };

        let net = row.total_debit_base - row.total_credit_base;

        match account.account_type {
            AccountType::Assets => {
                total_assets += net;
                asset_lines.push(BalanceSheetLineDto {
                    account_id: row.account_id.to_string(),
                    account_name: account.name_ar.clone(),
                    amount: net.to_string(),
                    account_code: account.code.clone(),
                    account_type: format!("{:?}", account.account_type),
                });
            }
            AccountType::Liabilities => {
                total_liabilities += net;
                liability_lines.push(BalanceSheetLineDto {
                    account_id: row.account_id.to_string(),
                    account_name: account.name_ar.clone(),
                    amount: net.to_string(),
                    account_code: account.code.clone(),
                    account_type: format!("{:?}", account.account_type),
                });
            }
            AccountType::Equity => {
                total_equity += net;
                equity_lines.push(BalanceSheetLineDto {
                    account_id: row.account_id.to_string(),
                    account_name: account.name_ar.clone(),
                    amount: net.to_string(),
                    account_code: account.code.clone(),
                    account_type: format!("{:?}", account.account_type),
                });
            }
            AccountType::Revenue => {
                // Revenue is credit-normal: positive credit = revenue.
                // net = debit - credit; for revenue credit > debit => negative net.
                total_revenue += -net;
            }
            AccountType::Expenses => {
                // Expenses are debit-normal: positive debit = expense.
                total_expenses += net;
            }
        }

        // Track drawings from the DRAWINGS system account
        if account.purpose == domain::accounting::account::AccountPurpose::PartnerDrawings {
            total_drawings += net.abs();
        }
    }

    asset_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));
    liability_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));
    equity_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));

    let net_profit = total_revenue - total_expenses;

    Ok(BalanceSheetDto {
        assets: asset_lines,
        liabilities: liability_lines,
        equity: equity_lines,
        total_assets: total_assets.to_string(),
        total_liabilities: total_liabilities.to_string(),
        total_equity: total_equity.to_string(),
        net_profit: net_profit.to_string(),
        total_drawings: total_drawings.to_string(),
        as_of_date: chrono::Utc::now().to_rfc3339(),
    })
}
