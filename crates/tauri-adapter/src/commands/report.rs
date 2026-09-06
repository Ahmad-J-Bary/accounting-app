use tauri::State;

use crate::bootstrap::container::AppState;
use application::dto::report_dto::{BalanceSheetDto, ProfitLossDto, ProfitLossLineDto, TrialBalanceDto, TrialBalanceLineDto};
use domain::accounting::account::{AccountType, NormalBalance};

/// Compute the normal balance side for an account type.
fn normal_balance(account_type: &AccountType) -> NormalBalance {
    match account_type {
        AccountType::Assets | AccountType::Expenses => NormalBalance::Debit,
        AccountType::Liabilities | AccountType::Equity | AccountType::Revenue => NormalBalance::Credit,
    }
}

/// Trial Balance: aggregated debit/credit per account across all posted,
/// non-reversed journal lines. The backend is the single source of truth.
#[tauri::command]
pub async fn get_trial_balance(state: State<'_, AppState>) -> Result<TrialBalanceDto, String> {
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

    let mut total_debit = rust_decimal::Decimal::ZERO;
    let mut total_credit = rust_decimal::Decimal::ZERO;

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

            total_debit += debit_total;
            total_credit += credit_total;

            Some(TrialBalanceLineDto {
                account_id: account.id.0.to_string(),
                account_code: account.code.clone(),
                account_name: account.name_ar.clone(),
                account_type: format!("{:?}", account.account_type),
                debit_total: debit_total.to_string(),
                credit_total: credit_total.to_string(),
                balance: net.to_string(),
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
    })
}

/// Income Statement (Profit & Loss): revenue and expense accounts aggregated
/// from the GL, net profit = total_revenue - total_expenses.
#[tauri::command]
pub async fn get_income_statement(
    state: State<'_, AppState>,
) -> Result<ProfitLossDto, String> {
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
                });
            }
            AccountType::Expenses => {
                // Expenses are debit-normal: positive debit = expense
                let amount = net; // net = debit - credit; for expenses, debit > credit => positive net
                total_expenses += amount;
                expense_lines.push(ProfitLossLineDto {
                    account_name: account.name_ar.clone(),
                    amount: amount.to_string(),
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
        period_start: String::new(),
        period_end: String::new(),
    })
}

/// Balance Sheet: assets, liabilities, and equity accounts aggregated from the
/// GL. Equity includes retained earnings from the GL (account 52).
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

    for row in agg_rows {
        let account = match account_map.get(&row.account_id) {
            Some(a) => a,
            None => continue,
        };

        let net = row.total_debit_base - row.total_credit_base;

        match account.account_type {
            AccountType::Assets => {
                total_assets += net;
                asset_lines.push(ProfitLossLineDto {
                    account_name: account.name_ar.clone(),
                    amount: net.to_string(),
                });
            }
            AccountType::Liabilities => {
                total_liabilities += net;
                liability_lines.push(ProfitLossLineDto {
                    account_name: account.name_ar.clone(),
                    amount: net.to_string(),
                });
            }
            AccountType::Equity => {
                total_equity += net;
                equity_lines.push(ProfitLossLineDto {
                    account_name: account.name_ar.clone(),
                    amount: net.to_string(),
                });
            }
            _ => continue,
        }
    }

    asset_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));
    liability_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));
    equity_lines.sort_by(|a, b| a.account_name.cmp(&b.account_name));

    Ok(BalanceSheetDto {
        assets: asset_lines,
        liabilities: liability_lines,
        equity: equity_lines,
        total_assets: total_assets.to_string(),
        total_liabilities: total_liabilities.to_string(),
        total_equity: total_equity.to_string(),
        as_of_date: chrono::Utc::now().to_rfc3339(),
    })
}
